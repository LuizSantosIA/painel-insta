import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStatusConteudo } from "@/lib/maquina";

/**
 * Edita um conteúdo.
 *
 * `category` já era editável na tabela de posts e continua igual. O pipeline
 * editorial acrescentou status, data de agendamento e legenda — só fazem sentido
 * para conteúdo planejado aqui dentro, então a rota recusa mexer em legenda de
 * post que veio do Instagram (lá a legenda é a fonte da verdade).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: {
    category?: string | null;
    status?: string;
    agendadoPara?: Date | null;
    postedAt?: Date;
    caption?: string;
  } = {};

  if ("category" in body) {
    data.category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : null;
  }

  if ("status" in body) {
    if (!isStatusConteudo(body.status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }
    data.status = body.status;
  }

  if ("agendadoPara" in body) {
    const valor = body.agendadoPara;
    if (valor === null || valor === "") {
      data.agendadoPara = null;
    } else if (typeof valor === "string" && !Number.isNaN(Date.parse(valor))) {
      const quando = new Date(valor);
      data.agendadoPara = quando;
      // O calendário posiciona pelo postedAt; agendar move o card de lugar.
      data.postedAt = quando;
    } else {
      return NextResponse.json({ error: "Data de agendamento inválida" }, { status: 400 });
    }
  }

  if ("caption" in body && typeof body.caption === "string") {
    data.caption = body.caption;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const atual = await prisma.post.findUnique({
    where: { id },
    select: { igId: true, status: true },
  });
  if (!atual) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  if (atual.igId && (data.caption !== undefined || data.status !== undefined)) {
    return NextResponse.json(
      { error: "Conteúdo publicado no Instagram: só o tema pode ser editado aqui" },
      { status: 409 }
    );
  }

  const post = await prisma.post.update({ where: { id }, data });
  return NextResponse.json({ ok: true, post });
}

/** Descarta um conteúdo planejado. Post publicado no Instagram nunca some daqui. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({ where: { id }, select: { igId: true } });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  if (post.igId) {
    return NextResponse.json(
      { error: "Este conteúdo veio do Instagram e não pode ser excluído do painel" },
      { status: 409 }
    );
  }

  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
