import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDataUTC } from "@/lib/financeiro";
import { INCLUDE_CLIENTE, toReceitaDTO } from "@/lib/financeiro-server";

/**
 * Marcar como recebida — a ação rápida da lista de receitas.
 *
 * Não há efeito colateral a propagar: Financeiro, painel, Cliente 360° e Saúde
 * derivam tudo desta mesma linha. Mudar o status aqui já apaga o alerta de
 * "Precisa da sua atenção", limpa a pendência da engine de saúde e soma o
 * pagamento no perfil do cliente, porque nenhum deles guarda cópia do dado.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const atual = await prisma.receita.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ error: "Receita não encontrada" }, { status: 404 });
  if (atual.status === "RECEBIDA") {
    return NextResponse.json(
      { error: "Esta receita já está marcada como recebida" },
      { status: 409 }
    );
  }

  // Data opcional: sem corpo, o recebimento é hoje.
  let em: Date = new Date();
  try {
    const body = await req.json();
    if (typeof body?.em === "string" && body.em) em = parseDataUTC(body.em);
  } catch {
    // corpo vazio é o caso normal
  }

  const receita = await prisma.receita.update({
    where: { id },
    data: { status: "RECEBIDA", dataRecebida: em, atualizadoEm: new Date() },
    include: INCLUDE_CLIENTE,
  });

  return NextResponse.json(toReceitaDTO(receita));
}

/** Desfazer — devolve a receita para "a receber" e apaga a data. */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const receita = await prisma.receita.update({
    where: { id },
    data: { status: "CONFIRMADA", dataRecebida: null, atualizadoEm: new Date() },
    include: INCLUDE_CLIENTE,
  });

  return NextResponse.json(toReceitaDTO(receita));
}
