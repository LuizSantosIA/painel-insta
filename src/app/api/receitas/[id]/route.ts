import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mesParaDate } from "@/lib/financeiro";

const PatchSchema = z.object({
  descricao:     z.string().min(1).optional(),
  valorCentavos: z.number().int().positive().optional(),
  linha:         z.enum(["INNOBI", "MENTORIA", "SERVICOS"]).optional(),
  tipo:          z.enum(["RECORRENTE", "PONTUAL"]).optional(),
  status:        z.enum(["PREVISTA", "CONFIRMADA", "RECEBIDA", "INADIMPLENTE"]).optional(),
  competencia:   z.string().regex(/^\d{4}-\d{2}$/).optional(),
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

  const { competencia: mesStr, dataRecebida, ...rest } = parsed.data;

  const receita = await prisma.receita.update({
    where: { id },
    data: {
      ...rest,
      ...(mesStr ? { competencia: mesParaDate(mesStr) } : {}),
      ...(dataRecebida !== undefined ? { dataRecebida: dataRecebida ? new Date(dataRecebida) : null } : {}),
      atualizadoEm: new Date(),
    },
    include: { cliente: { select: { id: true, name: true } } },
  });

  return NextResponse.json(receita);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.receita.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
