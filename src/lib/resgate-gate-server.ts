import "server-only";
import { prisma } from "@/lib/prisma";
import { isFollower, sendUrlButtons } from "@/lib/instagram";
import { gateConfigurado, rotuloLink, textoEntrega } from "@/lib/follow-gate-core";
import {
  candidatosNaJanela,
  decidirResgate,
  horasRestantes,
  LABEL_PULO,
  type GateParaResgate,
  type MotivoPulo,
} from "@/lib/resgate-gate";

/**
 * Entrega o link a quem clicou em "Seguindo" e nunca recebeu.
 *
 * Simula por padrão. Enviar de verdade é decisão explícita de quem chama —
 * são mensagens reais para pessoas reais, e um lote errado queima a conta.
 *
 * Três travas: janela de 23h, follow confirmado e lote pequeno com pausa
 * entre envios. Qualquer erro de limite da Meta interrompe o lote inteiro.
 */

/** Pausa entre dois envios. Evita cair no limite de taxa da Meta. */
const PAUSA_MS = 1200;

/** Teto por chamada, mesmo que peçam mais. */
const LOTE_MAXIMO = 50;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LinhaResgate {
  igsid: string;
  username: string;
  regra: string;
  horasRestantes: number;
  acao: "ENTREGARIA" | "ENTREGUE" | "PULADO" | "ERRO";
  motivo?: string;
}

export interface ResultadoResgate {
  simulacao: boolean;
  presos: number;
  naJanela: number;
  consultados: number;
  entregues: number;
  pulados: Partial<Record<MotivoPulo, number>>;
  erros: number;
  interrompido: string | null;
  linhas: LinhaResgate[];
}

/**
 * A última interação da pessoa: o que marca o começo da janela de 24h.
 * Pega o mais recente entre o movimento no gate e a última mensagem dela.
 */
async function ultimasInteracoes(igsids: string[]): Promise<Map<string, Date>> {
  if (!igsids.length) return new Map();
  const eventos = await prisma.dmEvent.findMany({
    where: { igsid: { in: igsids } },
    select: { igsid: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const mapa = new Map<string, Date>();
  for (const e of eventos) if (!mapa.has(e.igsid)) mapa.set(e.igsid, e.createdAt);
  return mapa;
}

export async function resgatarGates(opcoes: {
  simulacao?: boolean;
  limite?: number;
  agora?: Date;
}): Promise<ResultadoResgate> {
  const simulacao = opcoes.simulacao !== false;
  const limite = Math.min(Math.max(1, opcoes.limite ?? 25), LOTE_MAXIMO);
  const agora = opcoes.agora ?? new Date();

  const presos = await prisma.followGate.findMany({
    where: { status: { not: "DELIVERED" } },
    include: { rule: true },
    orderBy: { updatedAt: "desc" },
  });

  const mapaDm = await ultimasInteracoes(presos.map((g) => g.igsid));

  const comData: (GateParaResgate & { rule: (typeof presos)[number]["rule"] })[] = presos.map((g) => {
    const doDm = mapaDm.get(g.igsid);
    return {
      id: g.id,
      igsid: g.igsid,
      username: g.username,
      status: g.status,
      ultimaInteracaoEm: doDm && doDm > g.updatedAt ? doDm : g.updatedAt,
      rule: g.rule,
    };
  });

  const naJanela = candidatosNaJanela(comData, agora);
  const alvos = naJanela.slice(0, limite);

  const linhas: LinhaResgate[] = [];
  const pulados: Partial<Record<MotivoPulo, number>> = {};
  let entregues = 0;
  let erros = 0;
  let consultados = 0;
  let interrompido: string | null = null;

  for (const g of alvos) {
    const nome = g.rule.name || g.rule.keywords;

    // Regra desligada ou sem link não entrega nada: seria mandar uma promessa vazia.
    if (!g.rule.isActive || !gateConfigurado(g.rule)) {
      linhas.push({ igsid: g.igsid, username: g.username, regra: nome, horasRestantes: horasRestantes(g.ultimaInteracaoEm, agora), acao: "PULADO", motivo: "regra desligada ou sem link" });
      continue;
    }

    const segue = await isFollower(g.igsid);
    consultados++;

    const decisao = decidirResgate(g, segue, agora);
    if (!decisao.resgatar) {
      pulados[decisao.motivo] = (pulados[decisao.motivo] ?? 0) + 1;
      linhas.push({ igsid: g.igsid, username: g.username, regra: nome, horasRestantes: horasRestantes(g.ultimaInteracaoEm, agora), acao: "PULADO", motivo: LABEL_PULO[decisao.motivo] });
      continue;
    }

    if (simulacao) {
      linhas.push({ igsid: g.igsid, username: g.username, regra: nome, horasRestantes: horasRestantes(g.ultimaInteracaoEm, agora), acao: "ENTREGARIA" });
      continue;
    }

    try {
      await sendUrlButtons(g.igsid, textoEntrega(g.rule), [
        { title: rotuloLink(g.rule), url: g.rule.linkLiberado.trim() },
      ]);
      await prisma.followGate.update({
        where: { id: g.id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      entregues++;
      linhas.push({ igsid: g.igsid, username: g.username, regra: nome, horasRestantes: horasRestantes(g.ultimaInteracaoEm, agora), acao: "ENTREGUE" });
    } catch (e) {
      erros++;
      const msg = e instanceof Error ? e.message : String(e);
      linhas.push({ igsid: g.igsid, username: g.username, regra: nome, horasRestantes: horasRestantes(g.ultimaInteracaoEm, agora), acao: "ERRO", motivo: msg.slice(0, 120) });

      // Limite de taxa ou token recusado: insistir só piora. Para o lote.
      if (/rate limit|too many|calls to this api|\(#4\)|\(#613\)|190/i.test(msg)) {
        interrompido = `Interrompido em @${g.username || g.igsid}: ${msg.slice(0, 120)}`;
        break;
      }
    }

    await dormir(PAUSA_MS);
  }

  return {
    simulacao,
    presos: presos.length,
    naJanela: naJanela.length,
    consultados,
    entregues,
    pulados,
    erros,
    interrompido,
    linhas,
  };
}
