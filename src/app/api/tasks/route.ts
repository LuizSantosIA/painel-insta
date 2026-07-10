import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, dueDate, priority, clientId } = body;
  if (!title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || "medium",
      clientId: clientId || null,
    },
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(task, { status: 201 });
}
