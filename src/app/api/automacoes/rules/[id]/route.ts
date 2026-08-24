import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GATILHOS = ["COMENTARIO", "DM", "AMBOS"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.gatilho !== undefined && !GATILHOS.includes(body.gatilho)) {
    return NextResponse.json({ error: "gatilho inválido" }, { status: 400 });
  }

  // Só valida o link quando a trava fica (ou continua) ligada.
  if (body.exigirSeguir) {
    const link = typeof body.linkLiberado === "string" ? body.linkLiberado.trim() : null;
    const atual = link === null ? (await prisma.autoRule.findUnique({ where: { id } }))?.linkLiberado ?? "" : link;
    if (!/^https?:\/\//i.test(atual)) {
      return NextResponse.json(
        { error: "Informe o link (começando com http:// ou https://) que será liberado depois do follow" },
        { status: 400 }
      );
    }
  }

  const rule = await prisma.autoRule.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.keywords !== undefined && { keywords: body.keywords }),
      ...(body.replyText !== undefined && { replyText: body.replyText }),
      ...(body.sendDm !== undefined && { sendDm: Boolean(body.sendDm) }),
      ...(body.dmText !== undefined && { dmText: body.dmText }),
      ...(body.mediaId !== undefined && { mediaId: body.mediaId?.trim() || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.createLead !== undefined && { createLead: Boolean(body.createLead) }),
      ...(body.leadLinha !== undefined && { leadLinha: body.leadLinha || null }),
      ...(body.gatilho !== undefined && { gatilho: body.gatilho }),
      ...(body.exigirSeguir !== undefined && { exigirSeguir: Boolean(body.exigirSeguir) }),
      ...(body.linkLiberado !== undefined && { linkLiberado: body.linkLiberado?.trim() ?? "" }),
      ...(body.gateAskText !== undefined && { gateAskText: body.gateAskText }),
      ...(body.gateButtonLabel !== undefined && { gateButtonLabel: body.gateButtonLabel?.trim() || "Seguindo" }),
      ...(body.gateDeliverText !== undefined && { gateDeliverText: body.gateDeliverText }),
      ...(body.gateLinkLabel !== undefined && { gateLinkLabel: body.gateLinkLabel?.trim() || "Acessar" }),
    },
  });
  return NextResponse.json(rule);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.commentLog.deleteMany({ where: { ruleId: id } });
  await prisma.followGate.deleteMany({ where: { ruleId: id } });
  await prisma.autoRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
