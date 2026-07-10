import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  descricao: z.string().min(1),
  para: z.string().min(1),
  prazoEm: z.string().min(1),
  notas: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cumprido = searchParams.get("cumprido");

  const compromissos = await prisma.compromisso.findMany({
    where: cumprido !== null ? { cumprido: cumprido === "true" } : undefined,
    orderBy: [{ cumprido: "asc" }, { prazoEm: "asc" }],
  });

  return NextResponse.json(compromissos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { prazoEm, ...rest } = parsed.data;
  const compromisso = await prisma.compromisso.create({
    data: { ...rest, prazoEm: new Date(prazoEm) },
  });

  return NextResponse.json(compromisso, { status: 201 });
}
