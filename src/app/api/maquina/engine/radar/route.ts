import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { radarLerUrl, radarRegistrarTema } from "@/lib/engine/radar";
import { limparErro } from "@/lib/engine/ia";

const Schema = z.object({
  urls: z.array(z.string().url()).default([]),
  tema: z.string().optional(),
  contexto: z.string().optional(),
});

/** Alimenta o Radar: links colados e/ou um tema seu. */
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });

  const { urls, tema, contexto } = parsed.data;
  const resultados: { url: string; ok: boolean; fonteId?: string; nova?: boolean; erro?: string }[] = [];

  for (const url of urls) {
    try {
      const r = await radarLerUrl(url);
      resultados.push({ url, ok: true, ...r });
    } catch (e) {
      resultados.push({ url, ok: false, erro: limparErro(e) });
    }
  }

  const temaId = tema?.trim() ? await radarRegistrarTema(tema.trim(), contexto?.trim() ?? "") : null;

  return NextResponse.json({ resultados, temaId });
}
