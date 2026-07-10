import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

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
    },
  });
  return NextResponse.json(rule);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.commentLog.deleteMany({ where: { ruleId: id } });
  await prisma.autoRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}