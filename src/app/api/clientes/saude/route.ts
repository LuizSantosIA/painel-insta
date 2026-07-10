import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcSaude, type SaudeScore } from "@/lib/saude";

export interface ClienteSaudeItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  status: string;
  ultimoContatoEm: string | null;
  saudeNota: string | null;
  saude: SaudeScore;
  totalReceitas: number;
  mrrAtual: number;  // centavos — RECORRENTE + (CONFIRMADA|RECEBIDA) no mês atual
  temInadimplente: boolean;
  receitaVencida: boolean;
}

export async function GET() {
  const agora = new Date();
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const fimMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));

  const clientes = await prisma.client.findMany({
    where: { status: { in: ["active", "lead", "inactive"] } },
    include: {
      receitas: {
        select: { status: true, competencia: true, tipo: true, valorCentavos: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result: ClienteSaudeItem[] = clientes.map((c) => {
    const saude = calcSaude({
      status: c.status,
      ultimoContatoEm: c.ultimoContatoEm,
      receitas: c.receitas.map((r) => ({ status: r.status, competencia: r.competencia })),
    });

    const receitasMes = c.receitas.filter(
      (r) => new Date(r.competencia) >= inicioMes && new Date(r.competencia) < fimMes
    );

    const mrrAtual = receitasMes
      .filter((r) => r.tipo === "RECORRENTE" && (r.status === "CONFIRMADA" || r.status === "RECEBIDA"))
      .reduce((s, r) => s + r.valorCentavos, 0);

    const mesAtual = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      instagram: c.instagram,
      status: c.status,
      ultimoContatoEm: c.ultimoContatoEm?.toISOString() ?? null,
      saudeNota: c.saudeNota,
      saude,
      totalReceitas: c.receitas.length,
      mrrAtual,
      temInadimplente: c.receitas.some((r) => r.status === "INADIMPLENTE"),
      receitaVencida: c.receitas.some(
        (r) => r.status === "PREVISTA" && new Date(r.competencia) < mesAtual
      ),
    };
  });

  // Ordenação: VERMELHO → AMARELO → VERDE, depois por nome
  const ordem: Record<string, number> = { VERMELHO: 0, AMARELO: 1, VERDE: 2 };
  result.sort((a, b) => {
    const diff = (ordem[a.saude] ?? 3) - (ordem[b.saude] ?? 3);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "pt-BR");
  });

  return NextResponse.json(result);
}
