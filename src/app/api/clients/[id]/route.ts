import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Campos que o PATCH aceita. Evita gravar qualquer chave que venha no corpo. */
const CAMPOS_TEXTO = [
  "name",
  "email",
  "phone",
  "instagram",
  "company",
  "notes",
  "status",
  "source",
  "tags",
  "saudeNota",
] as const;

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  active: "Cliente",
  inactive: "Inativo",
  lost: "Perdido",
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const atual = await prisma.client.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};

  for (const campo of CAMPOS_TEXTO) {
    if (body[campo] === undefined) continue;
    const valor = typeof body[campo] === "string" ? body[campo].trim() : body[campo];
    // name é obrigatório; os demais aceitam null para limpar.
    data[campo] = campo === "name" ? valor : valor || null;
  }

  if (body.ultimoContatoEm !== undefined) {
    data.ultimoContatoEm = body.ultimoContatoEm ? new Date(body.ultimoContatoEm) : null;
  }
  if (body.arquivadoEm !== undefined) {
    data.arquivadoEm = body.arquivadoEm ? new Date(body.arquivadoEm) : null;
  }

  if (data.name !== undefined && !String(data.name).trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  const client = await prisma.client.update({ where: { id }, data });

  // Mudança de status vira histórico daqui para frente — nada é reconstruído.
  const novoStatus = data.status as string | undefined;
  if (novoStatus && novoStatus !== atual.status) {
    await prisma.interacao.create({
      data: {
        clienteId: id,
        tipo: "STATUS",
        nota: `${STATUS_LABELS[atual.status] ?? atual.status} → ${STATUS_LABELS[novoStatus] ?? novoStatus}`,
      },
    });
  }

  return NextResponse.json(client);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Interações somem junto (cascade). Leads, tarefas, compromissos e receitas
  // ficam, com o vínculo zerado — o histórico financeiro não pode evaporar.
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
