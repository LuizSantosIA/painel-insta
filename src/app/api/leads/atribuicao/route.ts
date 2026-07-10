import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface AtribuicaoItem {
  postOrigemId: string;
  total: number;
  fechados: number;
  perdidos: number;
}

export async function GET() {
  const leads = await prisma.lead.findMany({
    where: { postOrigemId: { not: null } },
    select: { id: true, estagio: true, postOrigemId: true },
  });

  const map = new Map<string, AtribuicaoItem>();
  for (const lead of leads) {
    const key = lead.postOrigemId!;
    if (!map.has(key)) {
      map.set(key, { postOrigemId: key, total: 0, fechados: 0, perdidos: 0 });
    }
    const item = map.get(key)!;
    item.total++;
    if (lead.estagio === "FECHADO") item.fechados++;
    if (lead.estagio === "PERDIDO") item.perdidos++;
  }

  const result = Array.from(map.values()).sort((a, b) => b.total - a.total);
  return NextResponse.json(result);
}
