import { NextRequest, NextResponse } from "next/server";
import { coletarBusca, varrerPendentes } from "@/lib/radar/execucao";
import { autorizar } from "@/lib/mcp/token";
import { env } from "@/lib/env";

/**
 * Recolhe o resultado de uma rodada.
 *
 * POST ?execucao=<id> → é o webhook do Apify avisando que o actor terminou.
 *                       O Apify não assina a chamada, então o que protege é o
 *                       id da execução (cuid) somado à checagem de estado: só
 *                       coleta rodada que está RODANDO, e coletar duas vezes
 *                       não duplica nada.
 * GET                 → varredura de segurança, chamada pelo cron.
 */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("execucao");
  if (!id) return NextResponse.json({ error: "Informe ?execucao=<id>." }, { status: 400 });

  const r = await coletarBusca(id);
  return NextResponse.json(r, { status: r.status === "ERRO" ? 500 : 200 });
}

export async function GET(req: NextRequest) {
  const segredo = env("CRON_SECRET");
  const doCron =
    Boolean(segredo) &&
    (req.headers.get("authorization") === `Bearer ${segredo}` || req.headers.get("x-cron-secret") === segredo);
  if (!doCron && !autorizar(req.headers).ok) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json(await varrerPendentes());
}
