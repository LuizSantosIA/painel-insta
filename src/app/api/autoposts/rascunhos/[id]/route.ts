import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const STATUS = ["RASCUNHO", "APROVADO", "REJEITADO", "PUBLICADO"] as const;

const PatchSchema = z.object({
  status:  z.enum(STATUS).optional(),
  legenda: z.string().min(1).optional(),
  topico:  z.string().min(1).optional(),
  slides:  z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const existing = await prisma.postRascunho.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.postRascunho.update({
    where: { id },
    data: { ...parsed.data, atualizadoEm: new Date() },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.postRascunho.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.postRascunho.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
