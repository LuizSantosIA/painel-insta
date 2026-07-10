import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rules = await prisma.autoRule.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, keywords, replyText, dmText, mediaId, leadLinha } = body as Record<string, string | undefined>;
  const sendDm = Boolean((body as Record<string, unknown>).sendDm);
  const createLead = Boolean((body as Record<string, unknown>).createLead);

  if (!keywords?.trim()) {
    return NextResponse.json({ error: "keywords é obrigatório" }, { status: 400 });
  }
  if (!replyText?.trim() && !dmText?.trim()) {
    return NextResponse.json({ error: "Preencha a resposta no comentário ou o texto do direct" }, { status: 400 });
  }
  if (createLead && !leadLinha) {
    return NextResponse.json({ error: "Escolha a linha de receita para gerar leads" }, { status: 400 });
  }

  const rule = await prisma.autoRule.create({
    data: {
      name: name?.trim() ?? "",
      keywords: keywords.trim(),
      replyText: replyText?.trim() ?? "",
      sendDm,
      dmText: dmText?.trim() ?? "",
      mediaId: mediaId?.trim() || null,
      createLead,
      leadLinha: createLead ? (leadLinha ?? null) : null,
    },
  });
  return NextResponse.json(rule, { status: 201 });
}