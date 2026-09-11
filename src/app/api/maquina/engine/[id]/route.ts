import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Etapa } from "@/lib/engine/etapas";

/** Tudo da tela do post: ideia, roteiro, visual, legenda, CTA, checklist e trilha. */
export interface PostEngineDetalhe {
  id: string;
  tituloInterno: string | null;
  etapa: Etapa | null;
  objetivo: string | null;
  tipoConteudo: string | null;
  tema: string | null;
  scoreEstrategia: Record<string, number | string> | null;
  scoreFinal: number | null;
  legendaFinal: string | null;
  palavraChave: string | null;
  agendadoPara: string | null;
  igId: string | null;
  permalink: string | null;
  fonte: { id: string; url: string; titulo: string | null; autor: string | null; plataforma: string | null } | null;
  estilo: { id: string; chave: string; nome: string } | null;
  estilosDisponiveis: { id: string; chave: string; nome: string }[];
  slides: {
    id: string;
    ordem: number;
    headline: string;
    corpo: string;
    microcopy: string;
    layout: string;
    promptVisual: string | null;
    imagemUrl: string | null;
    versao: number;
  }[];
  leadMagnet: { status: "SEM_CTA" | "PRONTO" | "PENDENTE"; destino: string | null; regraId: string | null; proposta: unknown } | null;
  checklist: { copy: boolean; design: boolean; factCheck: boolean | "ALERTA"; leadMagnet: boolean | "PENDENTE"; legenda: boolean };
  factCheck: unknown;
  revisorResumo: string | null;
  revisoes: { id: string; decisao: string; escopo: string; motivo: string; criadoEm: string }[];
  execucoes: { id: string; agente: string; etapa: string | null; status: string; modelo: string; tokensIn: number; tokensOut: number; duracaoMs: number; erro: string | null; criadoEm: string; slideOrdem: number | null }[];
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, estilos] = await Promise.all([
    prisma.post.findUnique({
      where: { id },
      include: {
        fonte: true,
        estiloVisual: true,
        slides: { orderBy: { ordem: "asc" } },
        autoRules: true,
        revisoes: { orderBy: { criadoEm: "desc" } },
        execucoes: { orderBy: { criadoEm: "desc" }, take: 60 },
      },
    }),
    prisma.estiloVisual.findMany({ where: { ativo: true }, select: { id: true, chave: true, nome: true } }),
  ]);
  if (!p) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  const ultimo = (agente: string) => p.execucoes.find((e) => e.agente === agente && e.status !== "ERRO");
  const parse = (s: string | null | undefined) => {
    try {
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };

  const fact = ultimo("FACT_CHECKER");
  const revisor = parse(ultimo("REVISOR")?.saida);
  const lead = ultimo("LEAD_MAGNET");
  const regra = p.autoRules[0] ?? null;

  const leadMagnet = p.palavraChave
    ? {
        status: regra && /^https?:\/\//i.test(regra.linkLiberado) ? ("PRONTO" as const) : ("PENDENTE" as const),
        destino: regra?.linkLiberado || null,
        regraId: regra?.id ?? null,
        proposta: parse(lead?.saida),
      }
    : { status: "SEM_CTA" as const, destino: null, regraId: null, proposta: null };

  const detalhe: PostEngineDetalhe = {
    id: p.id,
    tituloInterno: p.tituloInterno,
    etapa: (p.etapa as Etapa) ?? null,
    objetivo: p.objetivo,
    tipoConteudo: p.tipoConteudo,
    tema: p.tema,
    scoreEstrategia: parse(p.scoreEstrategia),
    scoreFinal: p.scoreFinal,
    legendaFinal: p.legendaFinal,
    palavraChave: p.palavraChave,
    agendadoPara: p.agendadoPara?.toISOString() ?? null,
    igId: p.igId,
    permalink: p.permalink,
    fonte: p.fonte ? { id: p.fonte.id, url: p.fonte.url, titulo: p.fonte.titulo, autor: p.fonte.autor, plataforma: p.fonte.plataforma } : null,
    estilo: p.estiloVisual ? { id: p.estiloVisual.id, chave: p.estiloVisual.chave, nome: p.estiloVisual.nome } : null,
    estilosDisponiveis: estilos,
    slides: p.slides.map((s) => ({
      id: s.id,
      ordem: s.ordem,
      headline: s.headline,
      corpo: s.corpo,
      microcopy: s.microcopy,
      layout: s.layout,
      promptVisual: s.promptVisual,
      imagemUrl: s.imagemUrl,
      versao: s.versao,
    })),
    leadMagnet,
    checklist: {
      copy: p.slides.length > 0,
      design: p.slides.length > 0 && p.slides.every((s) => s.imagemUrl),
      factCheck: fact ? (fact.status === "ALERTA" ? "ALERTA" : true) : false,
      leadMagnet: !p.palavraChave ? true : leadMagnet.status === "PRONTO" ? true : "PENDENTE",
      legenda: Boolean(p.legendaFinal?.trim()),
    },
    factCheck: parse(fact?.saida),
    revisorResumo: revisor?.resumoParaOLuiz ?? null,
    revisoes: p.revisoes.map((r) => ({ id: r.id, decisao: r.decisao, escopo: r.escopo, motivo: r.motivo, criadoEm: r.criadoEm.toISOString() })),
    execucoes: p.execucoes.map((e) => ({
      id: e.id,
      agente: e.agente,
      etapa: e.etapa,
      status: e.status,
      modelo: e.modelo,
      tokensIn: e.tokensIn,
      tokensOut: e.tokensOut,
      duracaoMs: e.duracaoMs,
      erro: e.erro,
      criadoEm: e.criadoEm.toISOString(),
      slideOrdem: e.slideOrdem,
    })),
  };

  return NextResponse.json(detalhe);
}

const PatchSchema = z.object({
  legendaFinal: z.string().optional(),
  palavraChave: z.string().nullable().optional(),
  estiloVisualId: z.string().nullable().optional(),
  slides: z
    .array(z.object({ ordem: z.number().int(), headline: z.string(), corpo: z.string(), microcopy: z.string().default("") }))
    .optional(),
});

/** Edição direta na tela do post: texto dos slides, legenda, palavra-chave, estilo. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });

  const { legendaFinal, palavraChave, estiloVisualId, slides } = parsed.data;

  await prisma.$transaction([
    prisma.post.update({
      where: { id },
      data: {
        ...(legendaFinal !== undefined && { legendaFinal }),
        ...(palavraChave !== undefined && { palavraChave: palavraChave?.trim().toUpperCase() || null }),
        ...(estiloVisualId !== undefined && { estiloVisualId }),
      },
    }),
    ...(slides ?? []).map((s) =>
      prisma.postSlide.updateMany({
        where: { postId: id, ordem: s.ordem },
        // Texto editado à mão invalida a imagem: precisa re-renderizar.
        data: { headline: s.headline, corpo: s.corpo, microcopy: s.microcopy, imagemUrl: null, versao: { increment: 1 } },
      })
    ),
  ]);

  return NextResponse.json({ ok: true });
}
