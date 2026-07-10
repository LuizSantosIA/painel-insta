import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ESTAGIOS = ["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "FECHADO", "PERDIDO"] as const;
const ORIGENS = ["INSTAGRAM_DM", "INSTAGRAM_COMENTARIO", "WHATSAPP", "EMAIL", "INDICACAO", "OUTRO"] as const;
const LINHAS = ["INNOBI", "MENTORIA", "SERVICOS"] as const;
const ATIVOS = ["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO"];

const PatchSchema = z.object({
  nome: z.string().min(1).optional(),
  contato: z.string().min(1).optional(),
  estagio: z.enum(ESTAGIOS).optional(),
  origem: z.enum(ORIGENS).optional(),
  linhaInteresse: z.enum(LINHAS).optional(),
  valorEstimadoCentavos: z.number().int().positive().nullable().optional(),
  proximaAcao: z.string().nullable().optional(),
  proximaAcaoEm: z.string().nullable().optional(),
  postOrigemId: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const current = await prisma.lead.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const merged = { ...current, ...parsed.data };
  const targetEstagio = merged.estagio ?? current.estagio;

  // Valida a regra inegociável ao mover para estágio ativo
  if (ATIVOS.includes(targetEstagio)) {
    if (!merged.proximaAcao?.trim()) {
      return NextResponse.json({ error: "Próxima ação obrigatória para leads ativos" }, { status: 422 });
    }
    if (!merged.proximaAcaoEm) {
      return NextResponse.json({ error: "Data da próxima ação obrigatória para leads ativos" }, { status: 422 });
    }
  }

  const { proximaAcaoEm, ...rest } = parsed.data;
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...rest,
      ...(proximaAcaoEm !== undefined ? { proximaAcaoEm: proximaAcaoEm ? new Date(proximaAcaoEm) : null } : {}),
    },
  });

  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lead.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
