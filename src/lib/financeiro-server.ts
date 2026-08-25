// Acesso ao banco para a camada financeira.
//
// Existe para que a tela de Financeiro, o painel de /negocio e a home leiam
// exatamente os mesmos registros com as mesmas fronteiras de data. As regras
// continuam em financeiro.ts (puras, testáveis); aqui só mora a consulta.

import { prisma } from "@/lib/prisma";
import {
  calcResumoFinanceiro,
  dateParaMes,
  mesParaDate,
  proximoMes,
  ultimosMeses,
  type ResumoFinanceiro,
} from "@/lib/financeiro";

/** Quantos meses de despesa entram na média do burn. */
export const MESES_BURN = 3;

/** Receita como o resto do sistema a consome — datas já em ISO. */
export interface ReceitaDTO {
  id: string;
  descricao: string;
  valorCentavos: number;
  linha: string;
  tipo: string;
  status: string;
  competencia: string;
  vencimento: string | null;
  dataRecebida: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  leadId: string | null;
  contratoId: string | null;
  criadoEm: string;
}

type ReceitaComCliente = {
  id: string;
  descricao: string;
  valorCentavos: number;
  linha: string;
  tipo: string;
  status: string;
  competencia: Date;
  vencimento: Date | null;
  dataRecebida: Date | null;
  clienteId: string | null;
  leadId: string | null;
  contratoId: string | null;
  criadoEm: Date;
  cliente?: { id: string; name: string } | null;
};

export function toReceitaDTO(r: ReceitaComCliente): ReceitaDTO {
  return {
    id: r.id,
    descricao: r.descricao,
    valorCentavos: r.valorCentavos,
    linha: r.linha,
    tipo: r.tipo,
    status: r.status,
    competencia: r.competencia.toISOString(),
    vencimento: r.vencimento?.toISOString() ?? null,
    dataRecebida: r.dataRecebida?.toISOString() ?? null,
    clienteId: r.clienteId,
    clienteNome: r.cliente?.name ?? null,
    leadId: r.leadId,
    contratoId: r.contratoId,
    criadoEm: r.criadoEm.toISOString(),
  };
}

export const INCLUDE_CLIENTE = { cliente: { select: { id: true, name: true } } } as const;

/** As receitas de uma competência ("yyyy-MM"), com o cliente vinculado. */
export function receitasDoMes(mes: string) {
  const start = mesParaDate(mes);
  return prisma.receita.findMany({
    where: { competencia: { gte: start, lt: proximoMes(start) } },
    include: INCLUDE_CLIENTE,
    orderBy: [{ competencia: "asc" }, { criadoEm: "desc" }],
  });
}

/**
 * Tudo que ainda não entrou, de qualquer competência. É a base do "a receber" e
 * do "vencido": um atraso de junho não pode sumir da tela ao navegar para agosto.
 */
export function receitasEmAberto() {
  return prisma.receita.findMany({
    where: { status: { notIn: ["RECEBIDA", "CANCELADA"] } },
    include: INCLUDE_CLIENTE,
    orderBy: { competencia: "asc" },
  });
}

/** Soma das despesas de cada um dos últimos N meses, do mais antigo ao atual. */
export async function despesasPorMes(
  n = MESES_BURN,
  referencia = new Date()
): Promise<{ mes: string; totalCentavos: number }[]> {
  const meses = ultimosMeses(n, referencia);
  const somas = await Promise.all(
    meses.map((m) => {
      const s = mesParaDate(m);
      return prisma.despesa.aggregate({
        where: { competencia: { gte: s, lt: proximoMes(s) } },
        _sum: { valorCentavos: true },
      });
    })
  );
  return meses.map((mes, i) => ({ mes, totalCentavos: somas[i]._sum.valorCentavos ?? 0 }));
}

/**
 * O resumo financeiro de um mês, pronto para qualquer tela.
 *
 * O burn do runway usa sempre os últimos meses reais (não o mês navegado):
 * runway é a situação do caixa hoje, não uma foto do passado.
 */
export async function carregarResumo(
  mes: string,
  agora = new Date()
): Promise<ResumoFinanceiro> {
  const start = mesParaDate(mes);
  const startPrev = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));

  const [receitasMes, receitasPrev, emAberto, config, burn, despesaMes] = await Promise.all([
    prisma.receita.findMany({ where: { competencia: { gte: start, lt: proximoMes(start) } } }),
    prisma.receita.findMany({ where: { competencia: { gte: startPrev, lt: start } } }),
    prisma.receita.findMany({ where: { status: { notIn: ["RECEBIDA", "CANCELADA"] } } }),
    prisma.config.findUnique({ where: { id: "singleton" } }),
    despesasPorMes(MESES_BURN, agora),
    prisma.despesa.aggregate({
      where: { competencia: { gte: start, lt: proximoMes(start) } },
      _sum: { valorCentavos: true },
    }),
  ]);

  return calcResumoFinanceiro({
    receitasMes,
    receitasMesAnterior: receitasPrev,
    receitasEmAberto: emAberto,
    saldoCentavos: config?.saldoCaixa ?? 0,
    despesasPorMes: burn,
    despesasMesCentavos: despesaMes._sum.valorCentavos ?? 0,
    agora,
  });
}

/** Mês corrente em "yyyy-MM", na mesma convenção UTC do resto do financeiro. */
export function mesCorrente(agora = new Date()): string {
  return dateParaMes(agora);
}
