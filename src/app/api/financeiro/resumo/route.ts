import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calcMRR,
  calcReceitaPontual,
  calcAReceber,
  calcRunway,
  calcVariacao,
  mesParaDate,
  ultimosMeses,
} from "@/lib/financeiro";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") ?? new Date().toISOString().slice(0, 7);

  const start = mesParaDate(mes);
  const end   = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  // Mês anterior para variação de MRR
  const startPrev = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const endPrev   = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  // Últimos 3 meses de despesas para runway
  const last3 = ultimosMeses(3);

  const [receitasMes, receitasPrev, config, ...despesasMeses] = await Promise.all([
    prisma.receita.findMany({ where: { competencia: { gte: start, lt: end } } }),
    prisma.receita.findMany({ where: { competencia: { gte: startPrev, lt: endPrev } } }),
    prisma.config.findUnique({ where: { id: "singleton" } }),
    ...last3.map((m) => {
      const s = mesParaDate(m);
      const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
      return prisma.despesa.aggregate({
        where: { competencia: { gte: s, lt: e } },
        _sum: { valorCentavos: true },
      });
    }),
  ]);

  const mrrAtual    = calcMRR(receitasMes);
  const mrrAnterior = calcMRR(receitasPrev);
  const saldo       = config?.saldoCaixa ?? 0;

  const despesasPorMes = despesasMeses.map((d) => ({
    totalCentavos: d._sum.valorCentavos ?? 0,
  }));

  return NextResponse.json({
    mes,
    mrrAtual,
    mrrVariacao:     calcVariacao(mrrAtual, mrrAnterior),
    receitaPontual:  calcReceitaPontual(receitasMes),
    aReceber:        calcAReceber(receitasMes),
    runway:          calcRunway(saldo, despesasPorMes),
    saldoCaixa:      saldo,
  });
}
