import { NextResponse } from "next/server";
import { carregarBriefing } from "@/lib/hoje-server";
import type { BriefingDoDia } from "@/lib/hoje";

/**
 * A tela Hoje em uma requisição.
 *
 * A montagem mora em lib/hoje-server para que a superfície MCP (o Jarvis
 * perguntando "o que tem para hoje?") leia exatamente o mesmo dia que a tela.
 */
export type HojeOverview = BriefingDoDia;

export async function GET() {
  return NextResponse.json(await carregarBriefing());
}
