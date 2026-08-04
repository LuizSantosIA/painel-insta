import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");
const API_VERSION = strip(process.env.IG_API_VERSION) || "v21.0";
const BASE = `https://graph.instagram.com/${API_VERSION}`;

interface RawParticipant { username: string; id: string }
interface RawMessage {
  id: string;
  message?: string;
  from?: { username?: string; id?: string };
  created_time: string;
}
interface RawConversation {
  id: string;
  updated_time: string;
  participants: { data: RawParticipant[] };
  messages: { data: RawMessage[] };
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = strip(process.env.IG_ACCESS_TOKEN);
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? res.statusText);
  return json as T;
}

export async function POST() {
  const token = strip(process.env.IG_ACCESS_TOKEN);
  const userId = strip(process.env.IG_USER_ID);

  if (!token || !userId) {
    return NextResponse.json({ error: "IG não configurado" }, { status: 400 });
  }

  try {
    const data = await graphGet<{ data: RawConversation[] }>(`${userId}/conversations`, {
      platform: "instagram",
      fields: "id,participants,updated_time,messages{id,message,from,created_time}",
      limit: "20",
    });

    const conversations = data.data ?? [];
    let synced = 0;
    let messages = 0;

    for (const conv of conversations) {
      const other = conv.participants.data.find(p => p.id !== userId);
      if (!other) continue;

      await prisma.igConversation.upsert({
        where: { id: conv.id },
        create: {
          id: conv.id,
          igUserId: other.id,
          igUsername: other.username,
          updatedAt: new Date(conv.updated_time),
        },
        update: {
          igUserId: other.id,
          igUsername: other.username,
          updatedAt: new Date(conv.updated_time),
          syncedAt: new Date(),
        },
      });
      synced++;

      for (const msg of conv.messages?.data ?? []) {
        if (!msg.id) continue;
        const fromId = msg.from?.id ?? "";
        const fromUsername = msg.from?.username ?? "";
        const fromMe = fromId === userId;

        await prisma.igMessage.upsert({
          where: { id: msg.id },
          create: {
            id: msg.id,
            conversationId: conv.id,
            text: msg.message ?? "",
            fromMe,
            fromUsername,
            createdAt: new Date(msg.created_time),
          },
          update: {
            text: msg.message ?? "",
            fromMe,
            fromUsername,
          },
        });
        messages++;
      }
    }

    return NextResponse.json({ ok: true, synced, messages });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
