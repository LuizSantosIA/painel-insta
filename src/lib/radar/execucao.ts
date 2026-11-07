import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  apifyConfigurado,
  custoEmCentavos,
  iniciarRun,
  lerDataset,
  runDeuCerto,
  runTerminou,
  statusRun,
} from "./apify";
import { montarInputMaps, traduzirItemMaps, type CandidatoMaps, type ItemMaps } from "./maps";
import { filtrarLote, REDES_PADRAO, type ContextoFiltro, type MotivoDescarte } from "./filtros";

/**
 * O ciclo de uma rodada do radar, em dois tempos.
 *
 *   iniciarBusca()  dispara o actor e volta na hora, guardando o runId
 *   coletarBusca()  lê o dataset, filtra, grava os prospects
 *
 * Em dois tempos porque o actor leva minutos e a função da Vercel morre em
 * 300s. O Apify chama o webhook quando termina; o cron de varredura é a rede
 * de segurança para quando o webhook não chega.
 */

export interface ConfigRadar {
  minAvaliacoes: number;
  redesExcluidas: string[];
  leadsPorDia: number;
  tetoCustoCentavos: number;
  actorMaps: string;
  maxResultadosBusca: number;
}

export async function carregarConfig(): Promise<ConfigRadar> {
  const c = await prisma.radarConfig.findUnique({ where: { id: "singleton" } });
  const redes = (() => {
    try {
      const lista = JSON.parse(c?.redesExcluidas ?? "[]") as unknown;
      return Array.isArray(lista) && lista.length ? (lista as string[]) : REDES_PADRAO;
    } catch {
      return REDES_PADRAO;
    }
  })();

  return {
    minAvaliacoes: c?.minAvaliacoes ?? 30,
    redesExcluidas: redes,
    leadsPorDia: c?.leadsPorDia ?? 20,
    tetoCustoCentavos: c?.tetoCustoCentavos ?? 1000,
    actorMaps: c?.actorMaps || "compass/crawler-google-places",
    maxResultadosBusca: c?.maxResultadosBusca ?? 100,
  };
}

/**
 * Tudo que já não pode entrar: bloqueios, opt-out, pipeline, clientes e
 * prospects que já existem. Montado uma vez por rodada.
 */
async function montarContexto(cfg: ConfigRadar): Promise<ContextoFiltro> {
  const [bloqueios, prospects, leads, clientes] = await Promise.all([
    prisma.radarBloqueio.findMany({ select: { chave: true, tipo: true } }),
    prisma.radarProspect.findMany({ select: { placeId: true, telefoneE164: true } }),
    prisma.lead.findMany({ select: { contato: true } }),
    prisma.client.findMany({ select: { phone: true } }),
  ]);

  const optOut = new Set<string>();
  const bloqueados = new Set<string>();
  for (const b of bloqueios) (b.tipo === "OPT_OUT" ? optOut : bloqueados).add(b.chave);

  // Prospect já existente conta como conhecido: a rodada de hoje não recria
  // o que a de ontem já trouxe. É o que torna o cron idempotente.
  const jaConhecidos = new Set<string>();
  for (const p of prospects) {
    jaConhecidos.add(p.placeId);
    if (p.telefoneE164) jaConhecidos.add(p.telefoneE164);
  }
  // O contato do Lead e o telefone do Client são texto livre; normalizamos
  // na comparação para não deixar passar o mesmo número escrito diferente.
  const { normalizarTelefone } = await import("./telefone");
  for (const l of leads) {
    const t = normalizarTelefone(l.contato);
    if (t) jaConhecidos.add(t.e164);
  }
  for (const c of clientes) {
    const t = normalizarTelefone(c.phone);
    if (t) jaConhecidos.add(t.e164);
  }

  return { optOut, bloqueados, jaConhecidos, redes: cfg.redesExcluidas, minAvaliacoes: cfg.minAvaliacoes };
}

export interface AlvoAtivo {
  id: string;
  vertical: string;
  verticalNome: string;
  termos: string[];
  cidade: string;
  uf: string;
}

export async function alvosAtivos(): Promise<AlvoAtivo[]> {
  const alvos = await prisma.radarAlvo.findMany({ where: { ativo: true }, orderBy: { vertical: "asc" } });
  return alvos.map((a) => ({
    id: a.id,
    vertical: a.vertical,
    verticalNome: a.verticalNome,
    termos: (() => {
      try {
        const t = JSON.parse(a.termosBusca) as unknown;
        return Array.isArray(t) ? (t as string[]) : [];
      } catch {
        return [];
      }
    })(),
    cidade: a.cidade,
    uf: a.uf,
  }));
}

export type ResultadoInicio =
  | { ok: true; execucaoId: string; runId: string; alvos: number }
  | { ok: false; erro: string };

/**
 * Dispara a busca. Uma rodada cobre todos os alvos ativos de uma vez: o actor
 * aceita vários termos, e um run só custa menos que vários.
 */
export async function iniciarBusca(origem: "CRON" | "MANUAL"): Promise<ResultadoInicio> {
  if (!apifyConfigurado()) return { ok: false, erro: "APIFY_TOKEN não configurado." };

  const [cfg, alvos] = await Promise.all([carregarConfig(), alvosAtivos()]);
  if (!alvos.length) return { ok: false, erro: "Nenhum alvo ativo. Ative uma vertical na configuração." };

  // Uma rodada por dia: se já existe uma de hoje que não falhou, não repete.
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const jaRodou = await prisma.radarExecucao.findFirst({
    where: { iniciadoEm: { gte: inicioDoDia }, status: { in: ["RODANDO", "OK"] }, origem: "CRON" },
  });
  if (jaRodou && origem === "CRON") {
    return { ok: false, erro: `Já rodou hoje (execução ${jaRodou.id}).` };
  }

  const termos = alvos.flatMap((a) => a.termos.map((t) => `${t} ${a.cidade}`));
  const input = montarInputMaps({
    termos,
    cidade: alvos[0].cidade,
    uf: alvos[0].uf,
    maxResultados: cfg.maxResultadosBusca,
  });

  const execucao = await prisma.radarExecucao.create({ data: { origem, status: "RODANDO" } });

  try {
    const base = env("APP_URL").replace(/\/+$/, "");
    const webhook = base ? `${base}/api/radar/coletar?execucao=${execucao.id}` : undefined;
    const run = await iniciarRun(cfg.actorMaps, input, webhook);

    await prisma.radarExecucao.update({
      where: { id: execucao.id },
      data: { apifyRunId: run.id, apifyDatasetId: run.defaultDatasetId },
    });

    return { ok: true, execucaoId: execucao.id, runId: run.id, alvos: alvos.length };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await prisma.radarExecucao.update({
      where: { id: execucao.id },
      data: { status: "ERRO", erro: erro.slice(0, 300), terminadoEm: new Date() },
    });
    return { ok: false, erro };
  }
}

export interface ResultadoColeta {
  status: "OK" | "RODANDO" | "ERRO" | "TETO_ESTOURADO";
  encontrados: number;
  novos: number;
  descartados: number;
  contagem?: Record<MotivoDescarte, number>;
  custoCentavos: number;
  erro?: string;
}

/**
 * Lê o resultado da rodada e grava os prospects.
 *
 * Idempotente: `skipDuplicates` no createMany e o contexto de filtragem, que
 * já conhece todo prospect existente. Chamar duas vezes para a mesma execução
 * não cria nada repetido.
 */
export async function coletarBusca(execucaoId: string): Promise<ResultadoColeta> {
  const execucao = await prisma.radarExecucao.findUnique({ where: { id: execucaoId } });
  if (!execucao) return { status: "ERRO", encontrados: 0, novos: 0, descartados: 0, custoCentavos: 0, erro: "Execução não encontrada." };
  if (!execucao.apifyRunId) return { status: "ERRO", encontrados: 0, novos: 0, descartados: 0, custoCentavos: 0, erro: "Execução sem run do Apify." };

  const run = await statusRun(execucao.apifyRunId);
  if (!runTerminou(run.status)) {
    return { status: "RODANDO", encontrados: 0, novos: 0, descartados: 0, custoCentavos: 0 };
  }

  const custoCentavos = custoEmCentavos(run.usageTotalUsd);
  const cfg = await carregarConfig();

  if (!runDeuCerto(run.status)) {
    await prisma.radarExecucao.update({
      where: { id: execucaoId },
      data: { status: "ERRO", erro: `Apify terminou como ${run.status}`, terminadoEm: new Date(), custoApifyCentavos: custoCentavos },
    });
    return { status: "ERRO", encontrados: 0, novos: 0, descartados: 0, custoCentavos, erro: `Apify: ${run.status}` };
  }

  // O teto é conferido depois do run porque o custo só é conhecido no fim —
  // o que ele protege é a rodada seguinte e o bolso acumulado.
  if (custoCentavos > cfg.tetoCustoCentavos) {
    await prisma.radarExecucao.update({
      where: { id: execucaoId },
      data: {
        status: "TETO_ESTOURADO",
        erro: `Custo R$ ${(custoCentavos / 100).toFixed(2)} passou do teto R$ ${(cfg.tetoCustoCentavos / 100).toFixed(2)}`,
        terminadoEm: new Date(),
        custoApifyCentavos: custoCentavos,
      },
    });
    return { status: "TETO_ESTOURADO", encontrados: 0, novos: 0, descartados: 0, custoCentavos };
  }

  const itens = await lerDataset<ItemMaps>(run.defaultDatasetId, cfg.maxResultadosBusca * 3);
  const alvos = await alvosAtivos();
  const porVertical = (c: CandidatoMaps): string => {
    const texto = `${c.nome} ${c.categorias}`.toLowerCase();
    const alvo = alvos.find((a) => a.termos.some((t) => texto.includes(t.toLowerCase().split(" ")[0])));
    return alvo?.vertical ?? alvos[0]?.vertical ?? "OUTRO";
  };

  const candidatos = itens
    .map((i) => traduzirItemMaps(i, { cidadeBusca: alvos[0]?.cidade ?? "Brasília", ufPadrao: alvos[0]?.uf ?? "DF" }))
    .filter((c): c is CandidatoMaps => c !== null);

  const ctx = await montarContexto(cfg);
  const { aceitos, contagem } = filtrarLote(
    candidatos.map((c) => ({ ...c, totalAvaliacoes: c.totalAvaliacoes })),
    ctx
  );

  // Um a um, com upsert: o SQLite não aceita skipDuplicates em createMany, e
  // o upsert por placeId é o que deixa a coleta repetível sem criar repetido.
  let gravados = 0;
  for (const c of aceitos) {
    const dados = {
      nome: c.nome,
      endereco: c.endereco,
      bairro: c.bairro,
      cidade: c.cidade,
      uf: c.uf,
      telefone: c.telefone,
      telefoneE164: c.e164,
      tipoTelefone: c.tipoTelefone,
      site: c.site,
      instagram: c.instagram,
      facebook: c.facebook,
      whatsapp: c.whatsapp,
      notaMaps: c.notaMaps,
      totalAvaliacoes: c.totalAvaliacoes,
      categorias: c.categorias,
      horario: c.horario,
      avaliacoesJson: c.avaliacoes.length ? JSON.stringify(c.avaliacoes) : null,
      vertical: porVertical(c),
      cidadeBusca: c.cidade,
    };
    try {
      await prisma.radarProspect.upsert({
        where: { placeId: c.placeId },
        create: { placeId: c.placeId, execucaoId, ...dados },
        // Numa reexecução, atualiza nota e avaliações mas preserva status,
        // mensagens e o vínculo com o pipeline — o que é seu não se perde.
        update: { notaMaps: dados.notaMaps, totalAvaliacoes: dados.totalAvaliacoes, avaliacoesJson: dados.avaliacoesJson },
      });
      gravados++;
    } catch (e) {
      // Telefone repetido com place_id novo: a empresa tem duas fichas no Maps.
      console.warn("[radar] prospect ignorado:", c.nome, (e as Error).message.slice(0, 80));
    }
  }

  const descartados = Object.values(contagem).reduce((s, n) => s + n, 0);

  await prisma.radarExecucao.update({
    where: { id: execucaoId },
    data: {
      status: "OK",
      terminadoEm: new Date(),
      encontrados: candidatos.length,
      novos: gravados,
      descartados,
      descartesJson: JSON.stringify(contagem),
      custoApifyCentavos: custoCentavos,
    },
  });

  return { status: "OK", encontrados: candidatos.length, novos: gravados, descartados, contagem, custoCentavos };
}

/** Rede de segurança: fecha rodadas que ficaram RODANDO sem o webhook chegar. */
export async function varrerPendentes(): Promise<{ verificadas: number; concluidas: number }> {
  const pendentes = await prisma.radarExecucao.findMany({
    where: { status: "RODANDO", apifyRunId: { not: null } },
    orderBy: { iniciadoEm: "asc" },
    take: 5,
  });

  let concluidas = 0;
  for (const p of pendentes) {
    const r = await coletarBusca(p.id).catch(() => null);
    if (r && r.status !== "RODANDO") concluidas++;
  }
  return { verificadas: pendentes.length, concluidas };
}
