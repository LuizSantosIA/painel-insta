import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IG_VERSION = "v21.0";
const TAGS = ["CAPA", "CONTEXTO", "IMPACTO", "AÇÃO", "CTA"];

interface Slide {
  titulo: string;
  corpo: string;
  imageUrl?: string | null;
  companyName?: string | null;
  brandColor?: string | null;
}

interface IgApiResponse {
  id?: string;
  error?: { message: string; code?: number };
}

interface ContainerStatus {
  status_code?: string;
}

function getBaseUrl(): string | null {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;
  if (host) return `https://${host}`;
  // Local dev com ngrok
  if (process.env.APP_URL) return process.env.APP_URL;
  return null;
}

async function createSlideContainer(
  userId: string,
  token: string,
  imageUrl: string
): Promise<string> {
  const res = await fetch(
    `https://graph.instagram.com/${IG_VERSION}/${userId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: token,
      }),
    }
  );
  const data = (await res.json()) as IgApiResponse;
  if (!data.id) {
    throw new Error(data.error?.message ?? "Erro ao criar container de mídia");
  }
  return data.id;
}

async function waitFinished(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const res = await fetch(
      `https://graph.instagram.com/${IG_VERSION}/${containerId}?fields=status_code&access_token=${token}`
    );
    const data = (await res.json()) as ContainerStatus;
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR")
      throw new Error(`Container ${containerId} falhou no processamento`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timeout aguardando processamento das imagens no Instagram");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Strip BOM (pode surgir via arquivo .env com encoding Windows ou pipe do PowerShell)
  const stripBom = (v?: string) => (v ?? "").replace(/^﻿/, "").replace(/^\xEF\xBB\xBF/, "");
  const token  = stripBom(process.env.IG_ACCESS_TOKEN);
  const userId = stripBom(process.env.IG_USER_ID);
  if (!token || !userId) {
    return NextResponse.json(
      { error: "Token do Instagram não configurado" },
      { status: 500 }
    );
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "URL base não configurada — configure APP_URL ou faça deploy na Vercel" },
      { status: 500 }
    );
  }

  const rascunho = await prisma.postRascunho.findUnique({ where: { id } });
  if (!rascunho)
    return NextResponse.json({ error: "Rascunho não encontrado" }, { status: 404 });
  if (rascunho.status !== "APROVADO")
    return NextResponse.json(
      { error: "O post precisa estar aprovado antes de publicar" },
      { status: 400 }
    );

  let slides: Slide[];
  try {
    slides = JSON.parse(rascunho.slides) as Slide[];
  } catch {
    return NextResponse.json({ error: "Slides inválidos" }, { status: 500 });
  }

  if (slides.length < 2) {
    return NextResponse.json(
      { error: "Carrossel precisa ter pelo menos 2 slides" },
      { status: 400 }
    );
  }

  try {
    // Monta URL de imagem para cada slide (gerada pela rota /api/autoposts/slide-image)
    const slideImageUrls = slides.map((slide, i) => {
      const p = new URLSearchParams({
        titulo: slide.titulo,
        corpo: slide.corpo,
        tag: TAGS[i] ?? String(i + 1),
        i: String(i),
        t: String(slides.length),
      });
      if (i === 0 && slide.imageUrl)    p.set("img",     slide.imageUrl);
      if (i === 0 && slide.companyName) p.set("company", slide.companyName);
      if (i === 0 && slide.brandColor)  p.set("color",   slide.brandColor);
      return `${baseUrl}/api/autoposts/slide-image?${p.toString()}`;
    });

    // Cria container de mídia para cada slide (sequencial para evitar rate-limit)
    const containerIds: string[] = [];
    for (const imgUrl of slideImageUrls) {
      const cid = await createSlideContainer(userId, token, imgUrl);
      containerIds.push(cid);
    }

    // Aguarda todos ficarem FINISHED
    await Promise.all(containerIds.map((cid) => waitFinished(cid, token)));

    // Cria o container do carrossel
    const carouselRes = await fetch(
      `https://graph.instagram.com/${IG_VERSION}/${userId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          caption: rascunho.legenda,
          children: containerIds.join(","),
          access_token: token,
        }),
      }
    );
    const carouselData = (await carouselRes.json()) as IgApiResponse;
    if (!carouselData.id)
      throw new Error(
        carouselData.error?.message ?? "Erro ao criar container do carrossel"
      );

    await waitFinished(carouselData.id, token);

    // Publica
    const publishRes = await fetch(
      `https://graph.instagram.com/${IG_VERSION}/${userId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: token,
        }),
      }
    );
    const publishData = (await publishRes.json()) as IgApiResponse;
    if (!publishData.id)
      throw new Error(
        publishData.error?.message ?? "Erro ao publicar no Instagram"
      );

    // Atualiza status no banco
    const updated = await prisma.postRascunho.update({
      where: { id },
      data: { status: "PUBLICADO", atualizadoEm: new Date() },
    });

    return NextResponse.json({
      success: true,
      igMediaId: publishData.id,
      rascunho: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
