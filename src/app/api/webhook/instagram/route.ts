import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { replyToComment, sendDmToCommenter } from "@/lib/instagram";

const VERIFY_TOKEN = (process.env.WEBHOOK_VERIFY_TOKEN ?? "").replace(/^﻿/, "");

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchesRule(text: string, keywords: string): boolean {
  const kws = keywords
    .split(",")
    .map((k) => normalize(k.trim()))
    .filter(Boolean);
  const norm = normalize(text);
  return kws.some((kw) => norm.includes(kw));
}

/** GET — Meta envia isso para verificar o endpoint antes de salvar o webhook. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** POST — Meta envia cada novo comentário em tempo real. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  console.log("[webhook] POST recebido, object:", body?.object, "entries:", body?.entry?.length ?? 0);

  // Sempre retorna 200 rápido para o Meta não reenviar
  if (!body || body.object !== "instagram") {
    console.log("[webhook] Ignorado — objeto não é instagram:", body?.object);
    return NextResponse.json({ ok: true });
  }

  // Processa de forma síncrona (em Vercel serverless, background tasks são canceladas)
  try {
    await processWebhook(body);
  } catch (e) {
    console.error("[webhook] Erro geral:", (e as Error).message);
  }

  return NextResponse.json({ ok: true });
}

async function processWebhook(body: {
  object: string;
  entry?: {
    id?: string;
    time?: number;
    changes?: {
      field: string;
      value: {
        id?: string;
        text?: string;
        username?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string };
      };
    }[];
  }[];
}) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      console.log("[webhook] change.field:", change.field);
      if (change.field !== "comments") continue;

      const value = change.value;
      const commentId = value.id ?? "";
      const text = value.text ?? "";
      const username = value.from?.username ?? value.username ?? "";
      const senderId = value.from?.id ?? "";
      const mediaId = value.media?.id ?? "";

      console.log("[webhook] comentário:", { commentId, text: text.slice(0, 50), username, mediaId });

      if (!commentId || !text) {
        console.log("[webhook] Sem commentId ou text, pulando");
        continue;
      }

      // Idempotência — não processa o mesmo comentário duas vezes
      const existing = await prisma.commentLog.findUnique({
        where: { igCommentId: commentId },
      });
      if (existing) {
        console.log("[webhook] Comentário já processado:", commentId);
        continue;
      }

      const rules = await prisma.autoRule.findMany({ where: { isActive: true } });
      console.log("[webhook] Regras ativas:", rules.length, rules.map(r => ({ id: r.id, keywords: r.keywords, mediaId: r.mediaId })));
      const rule = rules.find(
        (r) => (!r.mediaId || r.mediaId === mediaId) && matchesRule(text, r.keywords)
      );
      if (!rule) {
        console.log("[webhook] Nenhuma regra bateu para:", text);
        continue;
      }
      console.log("[webhook] Regra ativada:", rule.id, rule.name);

      let commentReplied = false;
      let dmSentOk = false;

      if (rule.replyText.trim()) {
        try {
          await replyToComment(commentId, rule.replyText);
          commentReplied = true;
          console.log("[webhook] Resposta pública enviada OK");
        } catch (e) {
          console.error("[webhook] Falha na resposta pública:", (e as Error).message);
        }
      }

      if (rule.sendDm && rule.dmText.trim()) {
        try {
          await sendDmToCommenter(commentId, rule.dmText);
          dmSentOk = true;
          console.log("[webhook] DM enviado OK");
        } catch (e) {
          console.error("[webhook] DM falhou para comment", commentId, (e as Error).message);
        }
      }

      if (commentReplied || dmSentOk) {
        await prisma.commentLog.create({
          data: {
            igCommentId: commentId,
            igPostId: mediaId,
            text,
            username,
            senderId,
            repliedAt: commentReplied ? new Date() : null,
            dmSentAt: dmSentOk ? new Date() : null,
            ruleId: rule.id,
          },
        });
        await prisma.autoRule.update({
          where: { id: rule.id },
          data: { triggerCount: { increment: 1 } },
        });
        console.log("[webhook] Log salvo no banco");
      }
    }
  }
}
