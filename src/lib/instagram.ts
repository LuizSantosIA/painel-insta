import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Integração com a Meta Graph API (Instagram).
 *
 * Pré-requisitos (feitos UMA vez, fora do código):
 *  1. Conta do Instagram Business ou Creator vinculada a uma Página do Facebook.
 *  2. App criado em https://developers.facebook.com (produto "Instagram Graph API").
 *  3. Gerar um token de acesso de longa duração com as permissões:
 *     instagram_basic, instagram_manage_insights, pages_read_engagement.
 *  4. Descobrir o IG User ID (id da conta business).
 *
 * Depois é só preencher no .env:
 *     IG_ACCESS_TOKEN=...
 *     IG_USER_ID=...
 * e chamar POST /api/sync (botão "Sincronizar" no painel).
 */

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const API_VERSION = strip(process.env.IG_API_VERSION) || "v21.0";
const BASE = `https://graph.instagram.com/${API_VERSION}`;

export function isConfigured(): boolean {
  return Boolean(strip(process.env.IG_ACCESS_TOKEN) && strip(process.env.IG_USER_ID));
}

interface RawMedia {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

/** Normaliza o tipo: a API separa media_type de media_product_type. */
function normalizeMediaType(m: RawMedia): string {
  if (m.media_product_type === "REELS") return "REELS";
  if (m.media_product_type === "STORY") return "STORY";
  return m.media_type ?? "IMAGE";
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = strip(process.env.IG_ACCESS_TOKEN);
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? res.statusText;
    throw new Error(`Graph API: ${msg}`);
  }
  return json as T;
}

/** Busca a página de mídias mais recentes da conta. */
async function fetchMediaPage(limit: number): Promise<RawMedia[]> {
  const userId = strip(process.env.IG_USER_ID);
  const fields =
    "id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count";
  const data = await graphGet<{ data: RawMedia[] }>(`${userId}/media`, {
    fields,
    limit: String(limit),
  });
  return data.data ?? [];
}

/** Busca insights de uma mídia. Métricas variam por tipo; o que faltar vira 0. */
async function fetchInsights(
  mediaId: string,
  mediaType: string
): Promise<Record<string, number>> {
  // Reels: impressions não suportado, views é o novo nome de plays
  // VIDEO: suporta impressions e video_views
  // IMAGE/CAROUSEL: suporta impressions, sem métricas de vídeo
  let metrics: string;
  if (mediaType === "REELS") {
    metrics = "reach,views,saved,shares,likes,comments";
  } else if (mediaType === "VIDEO") {
    metrics = "reach,impressions,video_views,saved,shares,likes,comments";
  } else {
    metrics = "reach,impressions,saved,shares,likes,comments";
  }

  try {
    const data = await graphGet<{
      data: { name: string; period?: string; values?: { value: number }[]; value?: number }[];
    }>(`${mediaId}/insights`, { metric: metrics, period: "lifetime" });

    const out: Record<string, number> = {};
    for (const item of data.data ?? []) {
      out[item.name] = item.value ?? item.values?.[0]?.value ?? 0;
    }
    return out;
  } catch {
    return {};
  }
}

/** Busca seguidores atuais via API — retorna null se falhar. */
export async function fetchFollowersCount(): Promise<number | null> {
  if (!isConfigured()) return null;
  try {
    const data = await graphGet<{ followers_count?: number }>("me", {
      fields: "followers_count",
    });
    return data.followers_count ?? null;
  } catch {
    return null;
  }
}

export interface RawComment {
  id: string;
  text: string;
  username?: string;
  timestamp?: string;
  from?: { id: string; username?: string };
}

/** Busca comentários de uma mídia (requer instagram_business_manage_comments). */
export async function fetchComments(mediaId: string): Promise<RawComment[]> {
  try {
    const data = await graphGet<{ data: RawComment[] }>(`${mediaId}/comments`, {
      fields: "id,text,username,timestamp,from",
      limit: "100",
    });
    return data.data ?? [];
  } catch {
    return [];
  }
}

/** Responde a um comentário publicamente. */
export async function replyToComment(commentId: string, message: string): Promise<string | null> {
  const token = strip(process.env.IG_ACCESS_TOKEN);
  const url = new URL(`${BASE}/${commentId}/replies`);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro ao responder comentário");
  return (json as { id?: string }).id ?? null;
}

/** Envia DM em resposta a um comentário usando o comment_id como destinatário.
 *  Não precisa de Page Token — usa só o IG token com instagram_manage_messages. */
export async function sendDmToCommenter(commentId: string, message: string): Promise<void> {
  const token = strip(process.env.IG_ACCESS_TOKEN);
  const userId = strip(process.env.IG_USER_ID);
  const res = await fetch(`${BASE}/${userId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
      access_token: token,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro ao enviar DM por comment_id");
}

/** Envia um direct para um usuário pelo seu ID (fallback). */
export async function sendDirectMessage(recipientId: string, message: string): Promise<void> {
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;

  if (pageToken && pageId) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: pageToken,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? "Erro ao enviar DM via Página");
    return;
  }

  const token = strip(process.env.IG_ACCESS_TOKEN);
  const userId = strip(process.env.IG_USER_ID);
  const res = await fetch(`${BASE}/${userId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: token,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro ao enviar DM");
}

export interface SyncResult {
  fetched: number;
  upserted: number;
  errors: string[];
  followers?: number;
}

/** Sincroniza as últimas mídias da conta para o banco local. */
export async function syncInstagram(limit = 50): Promise<SyncResult> {
  if (!isConfigured()) {
    throw new Error(
      "Integração não configurada. Defina IG_ACCESS_TOKEN e IG_USER_ID no .env."
    );
  }

  const media = await fetchMediaPage(limit);
  const errors: string[] = [];
  let upserted = 0;

  // Busca seguidores atuais uma vez para usar como base de engajamento por post
  let currentFollowers = 0;
  try {
    const acct = await graphGet<{ followers_count?: number }>("me", { fields: "followers_count" });
    currentFollowers = acct.followers_count ?? 0;
  } catch { /* silent */ }

  for (const m of media) {
    try {
      const mediaType = normalizeMediaType(m);
      const ins = await fetchInsights(m.id, mediaType);

      const likes = ins.likes ?? m.like_count ?? 0;
      const comments = ins.comments ?? m.comments_count ?? 0;

      await prisma.post.upsert({
        where: { igId: m.id },
        create: {
          igId: m.id,
          caption: m.caption ?? null,
          mediaType,
          permalink: m.permalink ?? null,
          mediaUrl: m.media_url ?? null,
          thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
          postedAt: m.timestamp ? new Date(m.timestamp) : new Date(),
          likes,
          comments,
          saves: ins.saved ?? 0,
          shares: ins.shares ?? 0,
          reach: ins.reach ?? 0,
          impressions: ins.impressions ?? 0,
          videoViews: ins.views ?? ins.video_views ?? ins.plays ?? 0,
          followersAtPost: currentFollowers,
          source: "instagram",
        },
        update: {
          caption: m.caption ?? null,
          mediaType,
          permalink: m.permalink ?? null,
          mediaUrl: m.media_url ?? null,
          thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
          likes,
          comments,
          saves: ins.saved ?? 0,
          shares: ins.shares ?? 0,
          reach: ins.reach ?? 0,
          impressions: ins.impressions ?? 0,
          videoViews: ins.views ?? ins.video_views ?? ins.plays ?? 0,
          followersAtPost: currentFollowers,
          source: "instagram",
        },
      });
      upserted++;
    } catch (e) {
      errors.push(`${m.id}: ${(e as Error).message}`);
    }
  }

  // Salva snapshot diário de seguidores
  let followers: number | undefined;
  try {
    const accountData = await graphGet<{ followers_count?: number }>("me", {
      fields: "followers_count",
    });
    if (accountData.followers_count !== undefined) {
      followers = accountData.followers_count;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.accountSnapshot.upsert({
        where: { date: today },
        create: { date: today, followers, follows: 0, reach: 0 },
        update: { followers },
      });
    }
  } catch { /* silent */ }

  return { fetched: media.length, upserted, errors, followers };
}