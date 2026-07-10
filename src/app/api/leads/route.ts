import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ESTAGIOS = ["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "FECHADO", "PERDIDO"] as const;
const ORIGENS = ["INSTAGRAM_DM", "INSTAGRAM_COMENTARIO", "WHATSAPP", "EMAIL", "INDICACAO", "OUTRO"] as const;
const LINHAS = ["INNOBI", "MENTORIA", "SERVICOS"] as const;
const ATIVOS = ["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO"];

const CreateSchema = z
  .object({
    nome: z.string().min(1),
    contato: z.string().min(1),
    estagio: z.enum(ESTAGIOS).default("LEAD"),
    origem: z.enum(ORIGENS),
    linhaInteresse: z.enum(LINHAS),
    valorEstimadoCentavos: z.number().int().positive().nullable().optional(),
    proximaAcao: z.string().nullable().optional(),
    proximaAcaoEm: z.string().nullable().optional(),
    postOrigemId: z.string().nullable().optional(),
    notas: z.string().nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (ATIVOS.includes(d.estagio)) {
      if (!d.proximaAcao?.trim()) {
        ctx.addIssue({ code: "custom", path: ["proximaAcao"], message: "Obrigatório para leads ativos" });
      }
      if (!d.proximaAcaoEm) {
        ctx.addIssue({ code: "custom", path: ["proximaAcaoEm"], message: "Obrigatório para leads ativos" });
      }
    }
  });

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const estagio = searchParams.get("estagio");
  const linha = searchParams.get("linha");

  const leads = await prisma.lead.findMany({
    where: {
      ...(estagio ? { estagio } : {}),
      ...(linha ? { linhaInteresse: linha } : {}),
    },
    orderBy: [{ estagio: "asc" }, { proximaAcaoEm: "asc" }],
  });

  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { proximaAcaoEm, ...rest } = parsed.data;
  const lead = await prisma.lead.create({
    data: {
      ...rest,
      proximaAcaoEm: proximaAcaoEm ? new Date(proximaAcaoEm) : null,
    },
  });

  return NextResponse.json(lead, { status: 201 });
}
