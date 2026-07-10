import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const PatchSchema = z.object({
  descricao: z.string().min(1).optional(),
  para: z.string().min(1).optional(),
  prazoEm: z.string().optional(),
  cumprido: z.boolean().optional(),
  notas: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { prazoEm, cumprido, ...rest } = parsed.data;

  const compromisso = await prisma.compromisso.update({
    where: { id },
    data: {
      ...rest,
      ...(prazoEm !== undefined ? { prazoEm: new Date(prazoEm) } : {}),
      ...(cumprido !== undefined
        ? { cumprido, cumpridoEm: cumprido ? new Date() : null }
        : {}),
    },
  });

  return NextResponse.json(compromisso);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.compromisso.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.compromisso.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
