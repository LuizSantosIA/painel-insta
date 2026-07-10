import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcMRRPorLinha, mesParaDate, ultimosMeses } from "@/lib/financeiro";

const MES_LABELS: Record<number, string> = {
  0: "Jan", 1: "Fev", 2: "Mar", 3: "Abr", 4: "Mai", 5: "Jun",
  6: "Jul", 7: "Ago", 8: "Set", 9: "Out", 10: "Nov", 11: "Dez",
};

export async function GET() {
  const meses = ultimosMeses(6);

  const historico = await Promise.all(
    meses.map(async (mes) => {
      const start = mesParaDate(mes);
      const end   = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

      const receitas = await prisma.receita.findMany({
        where: {
          competencia: { gte: start, lt: end },
          tipo:   "RECORRENTE",
          status: { in: ["CONFIRMADA", "RECEBIDA"] },
        },
        select: { linha: true, tipo: true, status: true, valorCentavos: true },
      });

      const porLinha = calcMRRPorLinha(receitas);
      const label    = MES_LABELS[start.getUTCMonth()];

      return { mes: label, ...porLinha, total: Object.values(porLinha).reduce((s, v) => s + v, 0) };
    }),
  );

  return NextResponse.json(historico);
}
