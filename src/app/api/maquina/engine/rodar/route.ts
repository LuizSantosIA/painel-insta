import { NextRequest, NextResponse } from "next/server";
import { publicarVencidos, rodarDia, rodarProducao } from "@/lib/engine/orquestrador";

/**
 * Entrada do cron e do botão "Rodar máquina".
 *
 * Rota que gasta token não pode ficar aberta: exige ENGINE_CRON_SECRET quando a
 * variável existe. Sem a variável (dev local), aceita.
 */
function autorizado(req: NextRequest): boolean {
  const segredo = process.env.ENGINE_CRON_SECRET;
  if (!segredo) return true;
  const header = req.headers.get("authorization") ?? req.headers.get("x-engine-secret") ?? "";
  return header === `Bearer ${segredo}` || header === segredo;
}

async function executar(acao: string) {
  switch (acao) {
    case "dia":
      return rodarDia();
    case "publicar":
      return publicarVencidos();
    case "producao":
      return rodarProducao();
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const { acao = "producao" } = (await req.json().catch(() => ({}))) as { acao?: string };
  const r = await executar(acao);
  if (!r) return NextResponse.json({ error: "acao deve ser dia | producao | publicar" }, { status: 422 });
  return NextResponse.json(r);
}

/** O cron da Vercel chama por GET. */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const r = await executar(req.nextUrl.searchParams.get("acao") ?? "producao");
  if (!r) return NextResponse.json({ error: "acao deve ser dia | producao | publicar" }, { status: 422 });
  return NextResponse.json(r);
}
