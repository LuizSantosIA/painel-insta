import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calcEvolucao,
  calcPorLinha,
  calcProjecao30Dias,
  calcTopClientes,
  isVencida,
  mesParaDate,
  proximoMes,
  recorrentesPendentes,
  temHistoricoSuficiente,
  ultimosMeses,
  type ClienteReceita,
  type LinhaResumo,
  type PontoEvolucao,
  type ResumoFinanceiro,
} from "@/lib/financeiro";
import {
  carregarResumo,
  mesCorrente,
  receitasDoMes,
  receitasEmAberto,
  toReceitaDTO,
  type ReceitaDTO,
} from "@/lib/financeiro-server";

/** Quantos meses o gráfico de evolução cobre. */
const MESES_EVOLUCAO = 6;

export interface DespesaDTO {
  id: string;
  descricao: string;
  valorCentavos: number;
  categoria: string;
  recorrente: boolean;
  competencia: string;
}

/** Tudo que a tela de Financeiro precisa, numa requisição só. */
export interface FinanceiroOverview {
  mes: string;
  /** True quando o mês navegado é o mês corrente — a tela precisa saber para
   *  não chamar de "atual" um MRR de três meses atrás. */
  mesCorrente: boolean;
  resumo: ResumoFinanceiro;
  receitas: ReceitaDTO[];
  /** Vencidas de QUALQUER competência — a cobrança não é um assunto do mês. */
  vencidas: ReceitaDTO[];
  porLinha: LinhaResumo[];
  topClientes: ClienteReceita[];
  evolucao: PontoEvolucao[];
  temHistorico: boolean;
  projecao30Dias: number;
  despesas: DespesaDTO[];
  /** Recorrências do mês anterior ainda não lançadas neste mês. */
  recorrentesPendentes: number;
}

export async function GET(req: NextRequest) {
  const agora = new Date();
  const mes = req.nextUrl.searchParams.get("mes") ?? mesCorrente(agora);

  const start = mesParaDate(mes);
  const anterior = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const mesesSerie = ultimosMeses(MESES_EVOLUCAO, start);
  const inicioSerie = mesParaDate(mesesSerie[0]);

  const [resumo, receitasMes, abertas, recorrentesAnteriores, despesas, serieCrua] =
    await Promise.all([
      carregarResumo(mes, agora),
      receitasDoMes(mes),
      receitasEmAberto(),
      prisma.receita.findMany({
        where: {
          competencia: { gte: anterior, lt: start },
          tipo: "RECORRENTE",
          status: { not: "CANCELADA" },
        },
      }),
      prisma.despesa.findMany({
        where: { competencia: { gte: start, lt: proximoMes(start) } },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.receita.findMany({
        where: { competencia: { gte: inicioSerie, lt: proximoMes(start) } },
        select: {
          competencia: true,
          linha: true,
          tipo: true,
          status: true,
          valorCentavos: true,
          vencimento: true,
        },
      }),
    ]);

  const receitas = receitasMes.map(toReceitaDTO);
  const emAberto = abertas.map(toReceitaDTO);

  // Uma consulta só para os 6 meses; o agrupamento é em memória.
  const porMes = new Map<string, typeof serieCrua>();
  for (const m of mesesSerie) porMes.set(m, []);
  for (const r of serieCrua) {
    const chave = `${r.competencia.getUTCFullYear()}-${String(r.competencia.getUTCMonth() + 1).padStart(2, "0")}`;
    porMes.get(chave)?.push(r);
  }

  const evolucao = calcEvolucao(
    mesesSerie.map((m) => ({ mes: m, receitas: porMes.get(m) ?? [] })),
    agora
  );

  const overview: FinanceiroOverview = {
    mes,
    mesCorrente: mes === mesCorrente(agora),
    resumo,
    receitas,
    vencidas: emAberto.filter((r) => isVencida(r, agora)),
    porLinha: calcPorLinha(receitas, agora),
    topClientes: calcTopClientes(receitas, 5, agora),
    evolucao,
    temHistorico: temHistoricoSuficiente(evolucao),
    projecao30Dias: calcProjecao30Dias(emAberto, agora),
    despesas: despesas.map((d) => ({
      id: d.id,
      descricao: d.descricao,
      valorCentavos: d.valorCentavos,
      categoria: d.categoria,
      recorrente: d.recorrente,
      competencia: d.competencia.toISOString(),
    })),
    recorrentesPendentes: recorrentesPendentes(recorrentesAnteriores, receitasMes).length,
  };

  return NextResponse.json(overview);
}
