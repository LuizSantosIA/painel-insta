import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ saldoCaixa: z.number().int() });

export async function GET() {
  const config = await prisma.config.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", saldoCaixa: 0, atualizadoEm: new Date() },
    update: {},
  });
  return NextResponse.json({ saldoCaixa: config.saldoCaixa });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const config = await prisma.config.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", saldoCaixa: parsed.data.saldoCaixa, atualizadoEm: new Date() },
    update: { saldoCaixa: parsed.data.saldoCaixa, atualizadoEm: new Date() },
  });
  return NextResponse.json({ saldoCaixa: config.saldoCaixa });
}
