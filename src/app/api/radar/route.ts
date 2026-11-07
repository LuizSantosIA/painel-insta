import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apifyConfigurado } from "@/lib/radar/apify";
import { alvosAtivos, carregarConfig } from "@/lib/radar/execucao";
import type { MotivoDescarte } from "@/lib/radar/filtros";

/**
 * A lista de prospecção em uma requisição: prospects filtrados, as contagens
 * por status e a última rodada. A tela não faz conta nenhuma.
 */

export interface ProspectResumo {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string;
  uf: string;
  vertical: string;
  telefoneE164: string | null;
  tipoTelefone: string;
  site: string | null;
  instagram: string | null;
  notaMaps: number | null;
  totalAvaliacoes: number;
  categorias: string;
  anuncioStatus: string;
  score: number;
  resumoIa: string | null;
  status: string;
  enviadoEm: string | null;
  criadoEm: string;
}

export interface UltimaExecucao {
  id: string;
  status: string;
  origem: string;
  iniciadoEm: string;
  terminadoEm: string | null;
  encontrados: number;
  novos: number;
  descartados: number;
  descartes: Partial<Record<MotivoDescarte, number>>;
  custoCentavos: number;
  erro: string | null;
}

export interface RadarOverview {
  pronto: { apify: boolean; alvos: number };
  config: { minAvaliacoes: number; leadsPorDia: number; tetoCustoCentavos: number };
  porStatus: Record<string, number>;
  porVertical: Record<string, number>;
  total: number;
  ultimaExecucao: UltimaExecucao | null;
  prospects: ProspectResumo[];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const vertical = q.get("vertical") ?? "";
  const cidade = q.get("cidade") ?? "";
  const status = q.get("status") ?? "";
  const scoreMin = Number(q.get("scoreMin") ?? 0);
  const limite = Math.min(Number(q.get("limite") ?? 200), 500);

  const where = {
    ...(vertical ? { vertical } : {}),
    ...(cidade ? { cidade } : {}),
    ...(status ? { status } : {}),
    ...(scoreMin > 0 ? { score: { gte: scoreMin } } : {}),
  };

  const [config, alvos, prospects, total, porStatusRaw, porVerticalRaw, execucao] = await Promise.all([
    carregarConfig(),
    alvosAtivos(),
    prisma.radarProspect.findMany({
      where,
      orderBy: [{ score: "desc" }, { totalAvaliacoes: "desc" }],
      take: limite,
    }),
    prisma.radarProspect.count(),
    prisma.radarProspect.groupBy({ by: ["status"], _count: true }),
    prisma.radarProspect.groupBy({ by: ["vertical"], _count: true }),
    prisma.radarExecucao.findFirst({ orderBy: { iniciadoEm: "desc" } }),
  ]);

  const overview: RadarOverview = {
    pronto: { apify: apifyConfigurado(), alvos: alvos.length },
    config: {
      minAvaliacoes: config.minAvaliacoes,
      leadsPorDia: config.leadsPorDia,
      tetoCustoCentavos: config.tetoCustoCentavos,
    },
    porStatus: Object.fromEntries(porStatusRaw.map((s) => [s.status, s._count])),
    porVertical: Object.fromEntries(porVerticalRaw.map((v) => [v.vertical, v._count])),
    total,
    ultimaExecucao: execucao
      ? {
          id: execucao.id,
          status: execucao.status,
          origem: execucao.origem,
          iniciadoEm: execucao.iniciadoEm.toISOString(),
          terminadoEm: execucao.terminadoEm?.toISOString() ?? null,
          encontrados: execucao.encontrados,
          novos: execucao.novos,
          descartados: execucao.descartados,
          descartes: (() => {
            try {
              return JSON.parse(execucao.descartesJson ?? "{}") as Partial<Record<MotivoDescarte, number>>;
            } catch {
              return {};
            }
          })(),
          custoCentavos: execucao.custoApifyCentavos + execucao.custoIaCentavos,
          erro: execucao.erro,
        }
      : null,
    prospects: prospects.map((p) => ({
      id: p.id,
      nome: p.nome,
      bairro: p.bairro,
      cidade: p.cidade,
      uf: p.uf,
      vertical: p.vertical,
      telefoneE164: p.telefoneE164,
      tipoTelefone: p.tipoTelefone,
      site: p.site,
      instagram: p.instagram,
      notaMaps: p.notaMaps,
      totalAvaliacoes: p.totalAvaliacoes,
      categorias: p.categorias,
      anuncioStatus: p.anuncioStatus,
      score: p.score,
      resumoIa: p.resumoIa,
      status: p.status,
      enviadoEm: p.enviadoEm?.toISOString() ?? null,
      criadoEm: p.criadoEm.toISOString(),
    })),
  };

  return NextResponse.json(overview);
}
