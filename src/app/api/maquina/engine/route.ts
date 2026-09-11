import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ETAPAS, ETAPAS_PIPELINE, type Etapa } from "@/lib/engine/etapas";
import { execucoesHoje } from "@/lib/engine/ia";
import { modoAtual } from "@/lib/engine/orquestrador";
import { blobConfigurado } from "@/lib/engine/gerador";

/** A visão operacional da máquina: HOJE, pipeline e fila de aprovação. */
export interface PostEngineResumo {
  id: string;
  tituloInterno: string | null;
  etapa: Etapa;
  objetivo: string | null;
  tipoConteudo: string | null;
  tema: string | null;
  scoreFinal: number | null;
  scoreMedia: number | null;
  estilo: string | null;
  slides: number;
  slidesComImagem: number;
  capaUrl: string | null;
  agendadoPara: string | null;
  atualizadoEm: string;
  ultimoErro: string | null;
}

export interface EngineOverview {
  modo: string;
  pronto: { ia: boolean; blob: boolean; instagram: boolean };
  execucoes: { usadas: number; teto: number };
  hoje: {
    fontesEncontradas: number;
    selecionadas: number;
    emProducao: number;
    aguardandoAprovacao: number;
    agendadas: number;
    publicadas: number;
  };
  porEtapa: Record<string, number>;
  posts: PostEngineResumo[];
}

export async function GET() {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [posts, fontesHoje, modo, execucoes] = await Promise.all([
    prisma.post.findMany({
      where: { etapa: { in: [...ETAPAS] } },
      orderBy: { updatedAt: "desc" },
      include: {
        slides: { select: { ordem: true, imagemUrl: true }, orderBy: { ordem: "asc" } },
        estiloVisual: { select: { chave: true } },
        execucoes: { where: { status: "ERRO" }, orderBy: { criadoEm: "desc" }, take: 1, select: { erro: true } },
      },
    }),
    prisma.fonteConteudo.count({ where: { criadoEm: { gte: inicioDia }, descartada: false } }),
    modoAtual(),
    execucoesHoje(),
  ]);

  const porEtapa: Record<string, number> = {};
  for (const e of ETAPAS_PIPELINE) porEtapa[e] = 0;
  for (const p of posts) porEtapa[p.etapa!] = (porEtapa[p.etapa!] ?? 0) + 1;

  const resumo: PostEngineResumo[] = posts.map((p) => {
    let scoreMedia: number | null = null;
    try {
      scoreMedia = p.scoreEstrategia ? (JSON.parse(p.scoreEstrategia).media ?? null) : null;
    } catch {
      scoreMedia = null;
    }
    return {
      id: p.id,
      tituloInterno: p.tituloInterno,
      etapa: p.etapa as Etapa,
      objetivo: p.objetivo,
      tipoConteudo: p.tipoConteudo,
      tema: p.tema,
      scoreFinal: p.scoreFinal,
      scoreMedia,
      estilo: p.estiloVisual?.chave ?? null,
      slides: p.slides.length,
      slidesComImagem: p.slides.filter((s) => s.imagemUrl).length,
      capaUrl: p.slides[0]?.imagemUrl ?? null,
      agendadoPara: p.agendadoPara?.toISOString() ?? null,
      atualizadoEm: p.updatedAt.toISOString(),
      ultimoErro: p.execucoes[0]?.erro ?? null,
    };
  });

  const publicadasHoje = posts.filter(
    (p) => (p.etapa === "PUBLICADO" || p.etapa === "ANALISE") && p.postedAt >= inicioDia
  ).length;

  const overview: EngineOverview = {
    modo,
    pronto: {
      ia: Boolean(process.env.AI_GATEWAY_API_KEY),
      blob: blobConfigurado(),
      instagram: Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID),
    },
    execucoes,
    hoje: {
      fontesEncontradas: fontesHoje,
      selecionadas: porEtapa.SELECIONADA ?? 0,
      emProducao: (porEtapa.COPY ?? 0) + (porEtapa.DESIGN ?? 0) + (porEtapa.REVISAO ?? 0),
      aguardandoAprovacao: porEtapa.AGUARDANDO_APROVACAO ?? 0,
      agendadas: porEtapa.AGENDADO ?? 0,
      publicadas: publicadasHoje,
    },
    porEtapa,
    posts: resumo,
  };

  return NextResponse.json(overview);
}
