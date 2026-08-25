import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CATEGORIAS_DESPESA, mesParaDate, proximoMes } from "@/lib/financeiro";

const Schema = z.object({
  descricao:     z.string().min(1),
  valorCentavos: z.number().int().positive(),
  recorrente:    z.boolean().default(false),
  categoria:     z.enum(CATEGORIAS_DESPESA).default("OUTROS"),
  competencia:   z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  const start = mes ? mesParaDate(mes) : mesParaDate(new Date().toISOString().slice(0, 7));

  const despesas = await prisma.despesa.findMany({
    where: { competencia: { gte: start, lt: proximoMes(start) } },
    orderBy: { criadoEm: "desc" },
  });
  return NextResponse.json(despesas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { competencia: mesStr, ...rest } = parsed.data;
  const despesa = await prisma.despesa.create({
    data: { ...rest, competencia: mesParaDate(mesStr), criadoEm: new Date() },
  });
  return NextResponse.json(despesa, { status: 201 });
}
