import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gerarSlides } from "@/lib/engine/gerador";
import { diretorVisualDirigir } from "@/lib/engine/agentes";
import { limparErro } from "@/lib/engine/ia";

const Schema = z.object({
  ordens: z.array(z.number().int()).optional(),
  redirigir: z.boolean().default(false),
});

/** Regenerar slides: só os pedidos, com ou sem nova direção de arte. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });

  const { ordens, redirigir } = parsed.data;
  try {
    if (redirigir) await diretorVisualDirigir(id, ordens);
    const r = await gerarSlides(id, ordens);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: limparErro(e) }, { status: 500 });
  }
}
