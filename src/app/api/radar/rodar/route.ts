import { NextRequest, NextResponse } from "next/server";
import { iniciarBusca, varrerPendentes } from "@/lib/radar/execucao";
import { autorizar } from "@/lib/mcp/token";
import { env } from "@/lib/env";

/**
 * Dispara uma rodada do radar.
 *
 * GET  → é o cron da Vercel (Authorization: Bearer CRON_SECRET). Antes de
 *        iniciar, varre rodadas penduradas de ontem.
 * POST → é o botão "Rodar agora", protegido pelo mesmo token do MCP.
 *
 * Nada aqui espera o Apify: inicia a rodada e sai. A coleta é no webhook.
 */
export const maxDuration = 60;

function doCron(req: NextRequest): boolean {
  const segredo = env("CRON_SECRET");
  if (!segredo) return false;
  return req.headers.get("authorization") === `Bearer ${segredo}` || req.headers.get("x-cron-secret") === segredo;
}

export async function GET(req: NextRequest) {
  if (!doCron(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const varredura = await varrerPendentes();
  const r = await iniciarBusca("CRON");
  return NextResponse.json({ varredura, ...r }, { status: r.ok ? 200 : 409 });
}

export async function POST(req: NextRequest) {
  const v = autorizar(req.headers);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: v.status });

  const r = await iniciarBusca("MANUAL");
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
