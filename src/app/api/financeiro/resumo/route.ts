import { NextRequest, NextResponse } from "next/server";
import { carregarResumo, mesCorrente } from "@/lib/financeiro-server";

/**
 * Resumo financeiro de um mês. Consumido pela home ("Hoje") e por qualquer tela
 * que precise só dos números, sem as listas — o cálculo é o mesmo do Financeiro
 * e do painel de /negocio, porque todos passam por carregarResumo().
 */
export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") ?? mesCorrente();
  const resumo = await carregarResumo(mes);
  return NextResponse.json({ mes, ...resumo });
}
