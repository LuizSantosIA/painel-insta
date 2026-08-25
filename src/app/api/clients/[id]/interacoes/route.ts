import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIPOS_MANUAIS, isTipoInteracao } from "@/lib/cliente-360";
import { isContato } from "@/lib/saude";

/**
 * Interações são o registro do que já aconteceu com o cliente.
 * O que ainda precisa acontecer continua sendo Task ou Compromisso.
 */

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const interacoes = await prisma.interacao.findMany({
    where: { clienteId: id },
    orderBy: { ocorreuEm: "desc" },
  });
  return NextResponse.json(interacoes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const tipo = String(body.tipo ?? "");
  const nota = String(body.nota ?? "").trim();

  if (!isTipoInteracao(tipo) || !TIPOS_MANUAIS.includes(tipo)) {
    return NextResponse.json(
      { error: `tipo deve ser um de: ${TIPOS_MANUAIS.join(", ")}` },
      { status: 422 }
    );
  }
  // Contato dispensa texto: o "Registrar contato" da tela de Saúde grava o fato de
  // ter havido conversa, e a nota é opcional. Observação sem texto não é nada.
  if (!nota && !isContato(tipo)) {
    return NextResponse.json({ error: "Escreva uma nota curta sobre o que aconteceu" }, { status: 422 });
  }

  const cliente = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const ocorreuEm = body.ocorreuEm ? new Date(body.ocorreuEm) : new Date();
  if (Number.isNaN(ocorreuEm.getTime())) {
    return NextResponse.json({ error: "Data inválida" }, { status: 422 });
  }

  const interacao = await prisma.interacao.create({
    data: { clienteId: id, tipo, nota, ocorreuEm },
  });

  // Só conversa de verdade move o "último contato" — observação interna não.
  // A régua de quais tipos contam mora na engine (TIPOS_CONTATO em saude.ts).
  if (isContato(tipo)) {
    await prisma.client.update({
      where: { id },
      data: { ultimoContatoEm: ocorreuEm },
    });
  }

  return NextResponse.json(interacao, { status: 201 });
}
