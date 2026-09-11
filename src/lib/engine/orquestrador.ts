import "server-only";
import { prisma } from "@/lib/prisma";
import { publishCarousel } from "@/lib/instagram";
import {
  AGENTES_DA_ETAPA,
  avancaSozinha,
  escopoParaTexto,
  etapaAposAlteracao,
  isEtapa,
  isModo,
  podePublicarSozinha,
  proximaEtapa,
  statusDaEtapa,
  textoParaEscopo,
  type Decisao,
  type Escopo,
  type Etapa,
  type Modo,
} from "./etapas";
import { feedbackParaAprendizado } from "./memoria";
import {
  copywriterEscrever,
  diretorVisualDirigir,
  estrategistaSelecionar,
  factCheckerVerificar,
  leadMagnetPreparar,
  revisorAvaliar,
  viralAdapterAnalisar,
} from "./agentes";
import { gerarSlides } from "./gerador";
import { limparErro, registrarExecucao, TetoAtingidoError } from "./ia";

/**
 * Orquestrador: avança um post UMA etapa por chamada.
 *
 * Cada chamada cabe folgada nos 300s da função. Quem chama repetidamente (cron ou
 * botão) é quem dá continuidade; o estado vive no banco, então uma queda no meio
 * não perde nada — a próxima chamada retoma da etapa gravada.
 */

export async function modoAtual(): Promise<Modo> {
  const c = await prisma.config.findUnique({ where: { id: "singleton" }, select: { modoMaquina: true } });
  return isModo(c?.modoMaquina) ? c.modoMaquina : "COPILOTO";
}

async function moverPara(postId: string, etapa: Etapa, extra: Record<string, unknown> = {}) {
  await prisma.post.update({
    where: { id: postId },
    data: { etapa, status: statusDaEtapa(etapa), ...extra },
  });
}

/** Ordens de slide que a última alteração pediu — null quando é o post inteiro. */
async function slidesPedidos(postId: string): Promise<number[] | null> {
  const ultima = await prisma.revisaoConteudo.findFirst({
    where: { postId, decisao: "ALTERACAO" },
    orderBy: { criadoEm: "desc" },
  });
  if (!ultima) return null;
  const e = textoParaEscopo(ultima.escopo);
  return e.tipo === "SLIDE" ? [e.ordem] : null;
}

export type ResultadoAvanco =
  | { ok: true; de: Etapa; para: Etapa | null; detalhe?: string }
  | { ok: false; etapa: Etapa | null; erro: string };

/**
 * Executa os agentes da etapa atual e move o post para a próxima.
 * Em MANUAL, só roda se `forcar` — cada etapa espera um clique seu.
 */
export async function avancar(postId: string, forcar = false): Promise<ResultadoAvanco> {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const etapa = isEtapa(post.etapa) ? post.etapa : null;
  if (!etapa) return { ok: false, etapa: null, erro: "Post sem etapa da máquina." };

  const modo = await modoAtual();
  if (!forcar && !avancaSozinha(modo)) {
    return { ok: false, etapa, erro: "Modo MANUAL: avance pelo botão." };
  }

  const agentes = AGENTES_DA_ETAPA[etapa];
  if (!agentes) return { ok: false, etapa, erro: `Nada a executar em ${etapa}.` };

  try {
    let detalhe = "";

    for (const agente of agentes) {
      switch (agente) {
        case "VIRAL_ADAPTER": {
          if (post.tipoConteudo === "VIRAL_ADAPTADO" && post.fonteId) await viralAdapterAnalisar(postId);
          break;
        }
        case "COPYWRITER": {
          const s = await copywriterEscrever(postId);
          detalhe = `${s.slides.length} slides`;
          break;
        }
        case "DIRETOR_VISUAL": {
          const apenas = await slidesPedidos(postId);
          const d = await diretorVisualDirigir(postId, apenas ?? undefined);
          detalhe = `estilo ${d.estilo.chave}`;
          break;
        }
        case "GERADOR": {
          const apenas = await slidesPedidos(postId);
          const g = await gerarSlides(postId, apenas ?? undefined);
          detalhe += ` · ${g.gerados} imagens${g.erros ? `, ${g.erros} erro(s)` : ""}`;
          if (g.gerados === 0 && g.erros > 0) throw new Error("Nenhum slide foi gerado.");
          break;
        }
        case "FACT_CHECKER": {
          const f = await factCheckerVerificar(postId);
          detalhe = f.temAlerta ? "com alertas" : "sem alertas";
          break;
        }
        case "LEAD_MAGNET": {
          const l = await leadMagnetPreparar(postId);
          detalhe = `lead magnet ${l.status}`;
          break;
        }
        case "REVISOR": {
          const r = await revisorAvaliar(postId);
          detalhe += ` · score ${r.scoreFinal}`;
          break;
        }
      }
    }

    const para = proximaEtapa(etapa);
    if (para) await moverPara(postId, para);
    return { ok: true, de: etapa, para, detalhe: detalhe.replace(/^ · /, "") };
  } catch (e) {
    const erro = limparErro(e);
    if (!(e instanceof TetoAtingidoError)) {
      await registrarExecucao({ agente: agentes[0], etapa, postId, status: "ERRO", erro });
    }
    return { ok: false, etapa, erro };
  }
}

/**
 * Roda a produção: todo post em etapa de trabalho avança uma vez.
 * Chamado pelo cron (a cada X minutos) ou pelo botão "Rodar máquina".
 */
export async function rodarProducao(): Promise<{ avancados: number; falhas: string[] }> {
  const emProducao = await prisma.post.findMany({
    where: { etapa: { in: Object.keys(AGENTES_DA_ETAPA) } },
    orderBy: { updatedAt: "asc" },
    take: 5, // por chamada — o resto vai na próxima
    select: { id: true },
  });

  let avancados = 0;
  const falhas: string[] = [];
  for (const p of emProducao) {
    const r = await avancar(p.id);
    if (r.ok) avancados++;
    else {
      falhas.push(`${p.id}: ${r.erro}`);
      if (r.erro.includes("Teto diário")) break;
    }
  }
  return { avancados, falhas };
}

/** O dia da máquina: Estrategista seleciona, depois a produção avança. */
export async function rodarDia(): Promise<{ criados: number; descartadas: number; avancados: number; falhas: string[] }> {
  const sel = await estrategistaSelecionar();
  const prod = await rodarProducao();
  return { criados: sel.criados.length, descartadas: sel.descartadas, ...prod };
}

// ─── Aprovação ───────────────────────────────────────────────────────────────

export async function revisar(
  postId: string,
  decisao: Decisao,
  escopo: Escopo,
  motivo: string,
  agendarPara?: Date | null
): Promise<{ etapa: Etapa }> {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });

  await prisma.revisaoConteudo.create({
    data: { postId, decisao, escopo: escopoParaTexto(escopo), motivo: motivo.trim() },
  });

  // Todo motivo vira aprendizado — é assim que a máquina para de repetir o erro.
  if (decisao !== "APROVADO") {
    const a = feedbackParaAprendizado(motivo, escopoParaTexto(escopo));
    if (a) await prisma.aprendizado.create({ data: { origem: "FEEDBACK", texto: a.texto, tags: a.tags, postId } });
  }

  if (decisao === "APROVADO") {
    const quando = agendarPara ?? post.horarioSugerido ?? new Date(Date.now() + 60 * 60_000);
    await moverPara(postId, "AGENDADO", { agendadoPara: quando, postedAt: quando });
    // O lead magnet só liga quando o post vai ao ar; aqui só garante que está pronto.
    return { etapa: "AGENDADO" };
  }

  if (decisao === "REPROVADO") {
    await moverPara(postId, "REPROVADO");
    return { etapa: "REPROVADO" };
  }

  const volta = etapaAposAlteracao(escopo);
  await moverPara(postId, volta, { scoreFinal: null });
  return { etapa: volta };
}

// ─── Publicação ──────────────────────────────────────────────────────────────

/**
 * Publica um post AGENDADO cujo horário chegou. Só roda sozinho em AUTOPILOT;
 * nos outros modos precisa de `forcar` (o botão "Publicar agora").
 */
export async function publicar(postId: string, forcar = false): Promise<{ ok: boolean; igId?: string; erro?: string }> {
  const modo = await modoAtual();
  if (!forcar && !podePublicarSozinha(modo)) {
    return { ok: false, erro: `Modo ${modo}: publicação exige seu clique.` };
  }

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { slides: { orderBy: { ordem: "asc" } }, autoRules: true },
  });
  if (post.etapa !== "AGENDADO") return { ok: false, erro: `Post está em ${post.etapa}, não AGENDADO.` };

  const urls = post.slides.map((s) => s.imagemUrl).filter((u): u is string => !!u);
  if (urls.length !== post.slides.length) return { ok: false, erro: "Há slide sem imagem." };

  const inicio = Date.now();
  try {
    const igId = await publishCarousel(urls, post.legendaFinal ?? post.caption ?? "");

    await prisma.$transaction([
      prisma.post.update({
        where: { id: postId },
        data: { igId, etapa: "PUBLICADO", status: "PUBLICADO", postedAt: new Date(), source: "instagram" },
      }),
      // A automação do lead magnet passa a valer só para este post, agora que ele existe.
      ...post.autoRules.map((r) =>
        prisma.autoRule.update({ where: { id: r.id }, data: { mediaId: igId, isActive: /^https?:\/\//i.test(r.linkLiberado) } })
      ),
    ]);

    await registrarExecucao({ agente: "PUBLICADOR", etapa: "AGENDADO", postId, saida: { igId }, duracaoMs: Date.now() - inicio });
    return { ok: true, igId };
  } catch (e) {
    const erro = limparErro(e);
    await registrarExecucao({ agente: "PUBLICADOR", etapa: "AGENDADO", postId, status: "ERRO", erro, duracaoMs: Date.now() - inicio });
    return { ok: false, erro };
  }
}

/** Posts agendados cujo horário passou. O cron chama isto; em AUTOPILOT publica. */
export async function publicarVencidos(): Promise<{ publicados: number; pendentes: number }> {
  const agora = new Date();
  const vencidos = await prisma.post.findMany({
    where: { etapa: "AGENDADO", agendadoPara: { lte: agora } },
    select: { id: true },
  });
  let publicados = 0;
  for (const p of vencidos) {
    const r = await publicar(p.id);
    if (r.ok) publicados++;
  }
  return { publicados, pendentes: vencidos.length - publicados };
}
