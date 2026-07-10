import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const deals = await prisma.deal.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, value, stage, notes, dueDate, clientId } = body;
  if (!title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const deal = await prisma.deal.create({
    data: {
      title: title.trim(),
      value: Number(value) || 0,
      stage: stage || "lead",
      notes: notes?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      clientId: clientId || null,
    },
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json(deal, { status: 201 });
}
