import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mesParaDate, parseDataUTC, proximoMes, ultimoDiaDoMes } from "@/lib/financeiro";
import { INCLUDE_CLIENTE, mesCorrente, toReceitaDTO } from "@/lib/financeiro-server";

const Schema = z.object({
  descricao:     z.string().min(1, "Descrição obrigatória"),
  valorCentavos: z.number().int().positive("Valor deve ser positivo"),
  linha:         z.enum(["INNOBI", "MENTORIA", "SERVICOS"]),
  tipo:          z.enum(["RECORRENTE", "PONTUAL"]),
  status:        z.enum(["PREVISTA", "CONFIRMADA", "RECEBIDA", "INADIMPLENTE", "CANCELADA"]).default("PREVISTA"),
  competencia:   z.string().regex(/^\d{4}-\d{2}$/, "Formato: yyyy-MM"),
  vencimento:    z.string().nullable().optional(),
  clienteId:     z.string().nullable().optional(),
  leadId:        z.string().nullable().optional(),
  contratoId:    z.string().nullable().optional(),
  dataRecebida:  z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mes = searchParams.get("mes");
  const clienteId = searchParams.get("clienteId");

  // Sem mês, devolve tudo — a tela de cobrança precisa das competências antigas.
  const where: Record<string, unknown> = {};
  if (mes) {
    const start = mesParaDate(mes);
    where.competencia = { gte: start, lt: proximoMes(start) };
  }
  if (clienteId) where.clienteId = clienteId;

  const receitas = await prisma.receita.findMany({
    where,
    include: INCLUDE_CLIENTE,
    orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
  });

  return NextResponse.json(receitas.map(toReceitaDTO));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const {
    competencia: mesStr,
    vencimento,
    dataRecebida,
    clienteId,
    leadId,
    contratoId,
    ...rest
  } = parsed.data;

  const competencia = mesParaDate(mesStr || mesCorrente());

  const receita = await prisma.receita.create({
    data: {
      ...rest,
      competencia,
      // Sem data informada, vence no último dia da competência — a mesma régua
      // que as receitas anteriores a este campo já seguiam.
      vencimento: vencimento ? parseDataUTC(vencimento) : ultimoDiaDoMes(competencia),
      dataRecebida:
        dataRecebida ? new Date(dataRecebida)
        : rest.status === "RECEBIDA" ? new Date()
        : null,
      clienteId: clienteId ?? null,
      leadId: leadId ?? null,
      contratoId: contratoId ?? null,
      atualizadoEm: new Date(),
    },
    include: INCLUDE_CLIENTE,
  });

  // Toda recorrente é a primeira competência do próprio contrato. Guardar isso
  // aqui (e não na criação) evita gerar o id duas vezes.
  if (receita.tipo === "RECORRENTE" && !receita.contratoId) {
    const comContrato = await prisma.receita.update({
      where: { id: receita.id },
      data: { contratoId: receita.id },
      include: INCLUDE_CLIENTE,
    });
    return NextResponse.json(toReceitaDTO(comContrato), { status: 201 });
  }

  return NextResponse.json(toReceitaDTO(receita), { status: 201 });
}
