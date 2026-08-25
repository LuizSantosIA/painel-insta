import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  // Carimba a conclusão para a timeline do cliente. Tarefas concluídas antes
  // desta migração ficam sem data — não inventamos histórico retroativo.
  const concluidaEm =
    body.done === undefined ? undefined : body.done ? new Date() : null;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate,
      ...(concluidaEm !== undefined && { concluidaEm }),
      updatedAt: new Date(),
    },
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(task);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
