import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MODOS } from "@/lib/engine/etapas";

export async function GET() {
  const c = await prisma.config.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", atualizadoEm: new Date() },
    update: {},
    select: { modoMaquina: true, tetoExecucoesDia: true },
  });
  return NextResponse.json(c);
}

const Schema = z.object({
  modoMaquina: z.enum(MODOS).optional(),
  tetoExecucoesDia: z.number().int().min(1).max(1000).optional(),
});

/** Modo (MANUAL / COPILOTO / AUTOPILOT) e teto diário. Ligar AUTOPILOT é decisão sua, aqui. */
export async function PATCH(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const c = await prisma.config.update({
    where: { id: "singleton" },
    data: { ...parsed.data, atualizadoEm: new Date() },
    select: { modoMaquina: true, tetoExecucoesDia: true },
  });
  return NextResponse.json(c);
}
