import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AutoRule } from "@/generated/prisma/client";
import { replyToComment, sendDmToCommenter, sendDirectMessage } from "@/lib/instagram";
import {
  gateConfigurado,
  gatePendente,
  iniciarGatePorComentario,
  iniciarGatePorDm,
  normalizar,
  resolverCliqueGate,
  ruleIdDoPayload,
} from "@/lib/follow-gate";

const VERIFY_TOKEN = (process.env.WEBHOOK_VERIFY_TOKEN ?? "").replace(/^﻿/, "");

function matchesRule(text: string, keywords: string): boolean {
  const kws = keywords
    .split(",")
    .map((k) => normalizar(k))
    .filter(Boolean);
  const norm = normalizar(text);
  return kws.some((kw) => norm.includes(kw));
}

/** A regra aceita disparar a partir desta origem? Regras antigas ficam só em COMENTARIO. */
function aceitaGatilho(rule: AutoRule, origem: "COMENTARIO" | "DM"): boolean {
  if (rule.gatilho === "AMBOS") return true;
  return rule.gatilho === origem;
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

/** POST — Meta envia comentários (entry[].changes) e mensagens (entry[].messaging). */
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

interface CommentChange {
  field: string;
  value: {
    id?: string;
    text?: string;
    username?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string };
  };
}

interface MessagingEvent {
  sender?: { id?: string; username?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    quick_reply?: { payload?: string };
    reply_to?: { story?: { id?: string }; mid?: string };
  };
  postback?: {
    mid?: string;
    title?: string;
    payload?: string;
  };
}

interface WebhookBody {
  object: string;
  entry?: {
    id?: string;
    time?: number;
    changes?: CommentChange[];
    messaging?: MessagingEvent[];
  }[];
}

async function processWebhook(body: WebhookBody) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      console.log("[webhook] change.field:", change.field);
      if (change.field !== "comments") continue;
      await processarComentario(change);
    }

    for (const evento of entry.messaging ?? []) {
      await processarMensagem(evento);
    }
  }
}

// ─── Comentários ─────────────────────────────────────────────────────────────

async function processarComentario(change: CommentChange) {
  const value = change.value;
  const commentId = value.id ?? "";
  const text = value.text ?? "";
  const username = value.from?.username ?? value.username ?? "";
  const senderId = value.from?.id ?? "";
  const mediaId = value.media?.id ?? "";

  console.log("[webhook] comentário:", { commentId, text: text.slice(0, 50), username, mediaId });

  if (!commentId || !text) {
    console.log("[webhook] Sem commentId ou text, pulando");
    return;
  }

  // Idempotência — não processa o mesmo comentário duas vezes
  const existing = await prisma.commentLog.findUnique({
    where: { igCommentId: commentId },
  });
  if (existing) {
    console.log("[webhook] Comentário já processado:", commentId);
    return;
  }

  const rules = await prisma.autoRule.findMany({ where: { isActive: true } });
  const rule = rules.find(
    (r) =>
      aceitaGatilho(r, "COMENTARIO") &&
      (!r.mediaId || r.mediaId === mediaId) &&
      matchesRule(text, r.keywords)
  );
  if (!rule) {
    console.log("[webhook] Nenhuma regra bateu para:", text);
    return;
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

  if (gateConfigurado(rule)) {
    // Trava de seguidor: em vez do dmText, manda o pedido de follow com botão.
    const resultado = await iniciarGatePorComentario(rule, commentId, senderId, username, mediaId);
    dmSentOk = resultado === "PEDIDO_ENVIADO";
    console.log("[webhook] Gate por comentário:", resultado);
  } else if (rule.sendDm && rule.dmText.trim()) {
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

    await criarLeadSeConfigurado(rule, {
      username,
      senderId,
      postId: mediaId,
      origem: "INSTAGRAM_COMENTARIO",
    });
  }
}

// ─── Mensagens (DM, resposta de story, clique em botão) ──────────────────────

async function processarMensagem(evento: MessagingEvent) {
  const igsid = evento.sender?.id ?? "";
  if (!igsid) return;

  // Ecos são as nossas próprias mensagens voltando — ignorar sempre.
  if (evento.message?.is_echo || evento.message?.is_deleted) return;

  const mid = evento.message?.mid ?? evento.postback?.mid ?? "";
  const texto = evento.message?.text ?? evento.postback?.title ?? "";
  const payload = evento.message?.quick_reply?.payload ?? evento.postback?.payload ?? "";

  console.log("[webhook] mensagem:", { igsid, texto: texto.slice(0, 50), payload });

  if (!mid) return;

  // Idempotência — o Meta reenvia o mesmo mid quando acha que falhamos.
  try {
    await prisma.dmEvent.create({ data: { mid, igsid, text: texto.slice(0, 500) } });
  } catch {
    console.log("[webhook] mid já processado:", mid);
    return;
  }

  // 1. Clique no botão da trava de seguidor.
  const ruleIdDoBotao = payload ? ruleIdDoPayload(payload) : null;
  if (ruleIdDoBotao) {
    const resultado = await resolverCliqueGate(ruleIdDoBotao, igsid, evento.sender?.username ?? "");
    console.log("[webhook] Clique no gate:", ruleIdDoBotao, "→", resultado);
    return;
  }

  if (!texto.trim()) return;

  // 2. Fallback do private reply sem botão: a pessoa digitou o rótulo ("Seguindo").
  const pendente = await gatePendente(igsid);
  if (pendente) {
    const rotulo = normalizar(pendente.rule.gateButtonLabel || "Seguindo");
    if (normalizar(texto) === rotulo) {
      const resultado = await resolverCliqueGate(pendente.ruleId, igsid, pendente.username);
      console.log("[webhook] Gate resolvido por texto:", resultado);
      return;
    }
  }

  // 3. DM ou resposta de story batendo com uma regra de gatilho DM.
  const rules = await prisma.autoRule.findMany({ where: { isActive: true } });
  const rule = rules.find((r) => aceitaGatilho(r, "DM") && matchesRule(texto, r.keywords));
  if (!rule) {
    console.log("[webhook] Nenhuma regra de DM bateu para:", texto.slice(0, 50));
    return;
  }
  console.log("[webhook] Regra de DM ativada:", rule.id, rule.name);

  const storyId = evento.message?.reply_to?.story?.id ?? null;
  let enviou = false;

  if (gateConfigurado(rule)) {
    const resultado = await iniciarGatePorDm(rule, igsid, evento.sender?.username ?? "", storyId);
    enviou = resultado === "PEDIDO_ENVIADO" || resultado === "ENTREGUE";
    console.log("[webhook] Gate por DM:", resultado);
  } else if (rule.dmText.trim()) {
    try {
      await sendDirectMessage(igsid, rule.dmText);
      enviou = true;
      console.log("[webhook] Resposta de DM enviada OK");
    } catch (e) {
      console.error("[webhook] Falha ao responder DM:", (e as Error).message);
    }
  }

  if (enviou) {
    await prisma.autoRule.update({
      where: { id: rule.id },
      data: { triggerCount: { increment: 1 } },
    });
    await criarLeadSeConfigurado(rule, {
      username: evento.sender?.username ?? "",
      senderId: igsid,
      postId: storyId,
      origem: "INSTAGRAM_DM",
    });
  }
}

// ─── Ponte Instagram → Lead ──────────────────────────────────────────────────

async function criarLeadSeConfigurado(
  rule: AutoRule,
  dados: { username: string; senderId: string; postId: string | null; origem: string }
) {
  if (!rule.createLead || !rule.leadLinha) return;

  const contato = dados.username ? `@${dados.username}` : dados.senderId;
  if (!contato) return;

  const jaExiste = await prisma.lead.findFirst({
    where: { postOrigemId: dados.postId, contato },
  });
  if (jaExiste) {
    console.log("[webhook] Lead já existe para", contato, "— pulando");
    return;
  }

  const amanha = new Date();
  amanha.setUTCDate(amanha.getUTCDate() + 1);

  // A automação que criou o lead fica registrada: é o que permite medir, depois,
  // quais regras geram oportunidade — e não só quantas vezes dispararam.
  await prisma.lead.create({
    data: {
      nome: dados.username || dados.senderId,
      contato,
      estagio: "LEAD",
      origem: dados.origem,
      linhaInteresse: rule.leadLinha,
      proximaAcao: "Qualificar lead do Instagram",
      proximaAcaoEm: amanha,
      postOrigemId: dados.postId,
      automacaoId: rule.id,
      estagioDesde: new Date(),
    },
  });
  console.log("[webhook] Lead criado para", contato, "post", dados.postId);
}
