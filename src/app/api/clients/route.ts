import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { deals: true, tasks: { where: { done: false } } },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, instagram, company, notes, status, source, tags } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const client = await prisma.client.create({
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      instagram: instagram?.trim() || null,
      company: company?.trim() || null,
      notes: notes?.trim() || null,
      status: status || "lead",
      source: source || null,
      tags: tags?.trim() || null,
    },
  });
  return NextResponse.json(client, { status: 201 });
}
