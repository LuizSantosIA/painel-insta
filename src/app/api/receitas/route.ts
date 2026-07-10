import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mesParaDate } from "@/lib/financeiro";

const Schema = z.object({
  descricao:     z.string().min(1, "Descrição obrigatória"),
  valorCentavos: z.number().int().positive("Valor deve ser positivo"),
  linha:         z.enum(["INNOBI", "MENTORIA", "SERVICOS"]),
  tipo:          z.enum(["RECORRENTE", "PONTUAL"]),
  status:        z.enum(["PREVISTA", "CONFIRMADA", "RECEBIDA", "INADIMPLENTE"]).default("PREVISTA"),
  competencia:   z.string().regex(/^\d{4}-\d{2}$/, "Formato: yyyy-MM"),
  clienteId:     z.string().nullable().optional(),
  dataRecebida:  z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // "yyyy-MM" ou null
  const start = mes ? mesParaDate(mes) : mesParaDate(new Date().toISOString().slice(0, 7));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const receitas = await prisma.receita.findMany({
    where: { competencia: { gte: start, lt: end } },
    include: { cliente: { select: { id: true, name: true } } },
    orderBy: { criadoEm: "desc" },
  });

  return NextResponse.json(receitas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { competencia: mesStr, dataRecebida, clienteId, ...rest } = parsed.data;

  const receita = await prisma.receita.create({
    data: {
      ...rest,
      competencia:  mesParaDate(mesStr),
      dataRecebida: dataRecebida ? new Date(dataRecebida) : null,
      clienteId:    clienteId ?? null,
      atualizadoEm: new Date(),
    },
    include: { cliente: { select: { id: true, name: true } } },
  });

  return NextResponse.json(receita, { status: 201 });
}
