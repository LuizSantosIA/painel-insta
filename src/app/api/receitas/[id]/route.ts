import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mesParaDate, parseDataUTC } from "@/lib/financeiro";
import { INCLUDE_CLIENTE, toReceitaDTO } from "@/lib/financeiro-server";

const PatchSchema = z.object({
  descricao:     z.string().min(1).optional(),
  valorCentavos: z.number().int().positive().optional(),
  linha:         z.enum(["INNOBI", "MENTORIA", "SERVICOS"]).optional(),
  tipo:          z.enum(["RECORRENTE", "PONTUAL"]).optional(),
  status:        z.enum(["PREVISTA", "CONFIRMADA", "RECEBIDA", "INADIMPLENTE", "CANCELADA"]).optional(),
  competencia:   z.string().regex(/^\d{4}-\d{2}$/).optional(),
  vencimento:    z.string().nullable().optional(),
  clienteId:     z.string().nullable().optional(),
  dataRecebida:  z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const atual = await prisma.receita.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ error: "Receita não encontrada" }, { status: 404 });

  const { competencia: mesStr, vencimento, dataRecebida, ...rest } = parsed.data;

  // Marcar como recebida sem informar a data carimba agora; sair de RECEBIDA
  // limpa o carimbo, senão o histórico do cliente mostraria um pagamento fantasma.
  const virouRecebida = rest.status === "RECEBIDA" && atual.status !== "RECEBIDA";
  const deixouDeSerRecebida =
    rest.status !== undefined && rest.status !== "RECEBIDA" && atual.status === "RECEBIDA";

  const receita = await prisma.receita.update({
    where: { id },
    data: {
      ...rest,
      ...(mesStr ? { competencia: mesParaDate(mesStr) } : {}),
      ...(vencimento !== undefined
        ? { vencimento: vencimento ? parseDataUTC(vencimento) : null }
        : {}),
      ...(dataRecebida !== undefined
        ? { dataRecebida: dataRecebida ? new Date(dataRecebida) : null }
        : virouRecebida
          ? { dataRecebida: new Date() }
          : deixouDeSerRecebida
            ? { dataRecebida: null }
            : {}),
      atualizadoEm: new Date(),
    },
    include: INCLUDE_CLIENTE,
  });

  return NextResponse.json(toReceitaDTO(receita));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.receita.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
