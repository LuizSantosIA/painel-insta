import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DECISOES, textoParaEscopo } from "@/lib/engine/etapas";
import { avancar, revisar } from "@/lib/engine/orquestrador";

const Schema = z.object({
  decisao: z.enum(DECISOES),
  escopo: z.string().default("POST"),
  motivo: z.string().default(""),
  agendarPara: z.string().nullable().optional(),
});

/** O ponto principal do sistema: APROVAR · PEDIR ALTERAÇÃO · REPROVAR. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });

  const { decisao, escopo, motivo, agendarPara } = parsed.data;
  if (decisao !== "APROVADO" && !motivo.trim()) {
    return NextResponse.json(
      { error: "Diga o motivo — ele vira aprendizado para as próximas gerações." },
      { status: 422 }
    );
  }

  const r = await revisar(id, decisao, textoParaEscopo(escopo), motivo, agendarPara ? new Date(agendarPara) : null);

  // Alteração já dispara a primeira etapa do retrabalho, para você não esperar o cron.
  const avanco = decisao === "ALTERACAO" ? await avancar(id, true) : null;

  return NextResponse.json({ etapa: r.etapa, avanco });
}
