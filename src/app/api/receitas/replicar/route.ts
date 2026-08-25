import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  mesParaDate,
  proximoMes,
  recorrentesPendentes,
  ultimoDiaDoMes,
} from "@/lib/financeiro";
import { INCLUDE_CLIENTE, toReceitaDTO } from "@/lib/financeiro-server";

const Schema = z.object({
  /** Mês de destino, "yyyy-MM". */
  mes: z.string().regex(/^\d{4}-\d{2}$/),
});

/**
 * Lança no mês alvo as recorrências que vinham do mês anterior e ainda não têm
 * competência ali.
 *
 * Por que uma linha por mês, e não competências virtuais derivadas de um
 * contrato: status, vencimento e data de recebimento são fatos de um mês
 * específico. Um contrato que só guardasse "R$ 1.500/mês desde março" não teria
 * onde registrar que julho atrasou e agosto foi pago — e reconstruir isso pede
 * um ledger de cobrança, que é exatamente o sistema que não queremos aqui.
 *
 * A trava contra duplicar é o contratoId: uma recorrência já lançada no mês
 * alvo nunca é replicada de novo, quantas vezes a ação for disparada.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const destino = mesParaDate(parsed.data.mes);
  const origem = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() - 1, 1));

  const [doMesAnterior, jaNoDestino] = await Promise.all([
    prisma.receita.findMany({
      where: {
        competencia: { gte: origem, lt: destino },
        tipo: "RECORRENTE",
        status: { not: "CANCELADA" },
      },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.receita.findMany({
      where: { competencia: { gte: destino, lt: proximoMes(destino) }, tipo: "RECORRENTE" },
      select: { id: true, tipo: true, status: true, valorCentavos: true, contratoId: true },
    }),
  ]);

  const pendentes = recorrentesPendentes(doMesAnterior, jaNoDestino);
  if (pendentes.length === 0) {
    return NextResponse.json({ criadas: 0, receitas: [] });
  }

  // O vencimento acompanha o dia do mês anterior; se o mês alvo for mais curto,
  // cai no último dia dele em vez de vazar para o mês seguinte.
  const fimDoDestino = ultimoDiaDoMes(destino);
  function vencimentoNoDestino(anterior: Date | null): Date {
    if (!anterior) return fimDoDestino;
    const dia = Math.min(anterior.getUTCDate(), fimDoDestino.getUTCDate());
    return new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth(), dia));
  }

  const agora = new Date();
  const criadas = await prisma.$transaction(
    pendentes.map((p) => {
      const base = doMesAnterior.find((r) => r.id === p.id)!;
      return prisma.receita.create({
        data: {
          descricao: base.descricao,
          valorCentavos: base.valorCentavos,
          linha: base.linha,
          tipo: "RECORRENTE",
          // A réplica nasce a receber: o dinheiro do mês novo ainda não entrou.
          status: "CONFIRMADA",
          clienteId: base.clienteId,
          leadId: base.leadId,
          contratoId: base.contratoId ?? base.id,
          competencia: destino,
          vencimento: vencimentoNoDestino(base.vencimento),
          atualizadoEm: agora,
        },
        include: INCLUDE_CLIENTE,
      });
    })
  );

  return NextResponse.json(
    { criadas: criadas.length, receitas: criadas.map(toReceitaDTO) },
    { status: 201 }
  );
}
