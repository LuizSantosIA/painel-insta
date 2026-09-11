import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** A área avançada: execuções, fontes, aprendizados e estilos — fora da tela principal. */
export async function GET() {
  const [execucoes, fontes, aprendizados, estilos] = await Promise.all([
    prisma.execucaoAgente.findMany({
      orderBy: { criadoEm: "desc" },
      take: 80,
      include: { post: { select: { tituloInterno: true } } },
    }),
    prisma.fonteConteudo.findMany({
      orderBy: { criadoEm: "desc" },
      take: 40,
      select: {
        id: true, url: true, titulo: true, autor: true, plataforma: true, tema: true, formato: true,
        resumo: true, porQueFunciona: true, origem: true, descartada: true, criadoEm: true,
      },
    }),
    prisma.aprendizado.findMany({ orderBy: { criadoEm: "desc" }, take: 40 }),
    prisma.estiloVisual.findMany({ orderBy: { chave: "asc" } }),
  ]);

  return NextResponse.json({
    execucoes: execucoes.map((e) => ({
      id: e.id,
      post: e.post?.tituloInterno ?? null,
      postId: e.postId,
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
      prompt: e.prompt,
      saida: e.saida,
    })),
    fontes: fontes.map((f) => ({ ...f, criadoEm: f.criadoEm.toISOString() })),
    aprendizados: aprendizados.map((a) => ({ ...a, criadoEm: a.criadoEm.toISOString() })),
    estilos: estilos.map((e) => ({ ...e, criadoEm: e.criadoEm.toISOString() })),
  });
}
