import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");
const API_VERSION = strip(process.env.IG_API_VERSION) || "v21.0";
const BASE = `https://graph.instagram.com/${API_VERSION}`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Texto vazio" }, { status: 400 });

  const conv = await prisma.igConversation.findUnique({ where: { id } });
  if (!conv) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const token = strip(process.env.IG_ACCESS_TOKEN);
  const userId = strip(process.env.IG_USER_ID);

  const res = await fetch(`${BASE}/${userId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: conv.igUserId },
      message: { text: text.trim() },
      access_token: token,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json?.error?.message ?? "Erro ao enviar" }, { status: 400 });
  }

  // Salva a mensagem localmente para aparecer imediatamente
  const msgId = (json as { message_id?: string }).message_id ?? `local_${Date.now()}`;
  const saved = await prisma.igMessage.create({
    data: {
      id: msgId,
      conversationId: id,
      text: text.trim(),
      fromMe: true,
      fromUsername: "luizsantos.ia",
      createdAt: new Date(),
    },
  });
  await prisma.igConversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(saved, { status: 201 });
}
