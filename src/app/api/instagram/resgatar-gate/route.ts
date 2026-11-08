import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resgatarGates } from "@/lib/resgate-gate-server";
import { autorizar } from "@/lib/mcp/token";
import { camposFaltando } from "@/lib/instagram-token";
import { tokenAtual } from "@/lib/instagram-credenciais";

/**
 * Entrega o link a quem clicou em "Seguindo" e ficou esperando.
 *
 * Simula por padrão: `simulacao: false` é obrigatório para enviar de verdade.
 * E recusa enviar enquanto `messaging_postbacks` não estiver inscrito — sem
 * isso o problema continua produzindo gente presa, e o resgate vira enxugar
 * gelo.
 */

export const maxDuration = 300;

const Corpo = z.object({
  simulacao: z.boolean().default(true),
  limite: z.number().int().min(1).max(50).default(25),
  /** Libera o envio mesmo com o webhook ainda incompleto. */
  ignorarWebhook: z.boolean().default(false),
});

async function webhookIncompleto(): Promise<string[]> {
  try {
    const { token, userId } = await tokenAtual();
    const r = await fetch(`https://graph.instagram.com/v23.0/${userId}/subscribed_apps?access_token=${token}`);
    const j = (await r.json()) as { data?: { subscribed_fields?: string[] }[] };
    return camposFaltando(j.data?.[0]?.subscribed_fields ?? []);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const v = autorizar(req.headers);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: v.status });

  const corpo = Corpo.safeParse(await req.json().catch(() => ({})));
  if (!corpo.success) {
    return NextResponse.json({ error: "Envie { simulacao?, limite?, ignorarWebhook? }." }, { status: 400 });
  }
  const { simulacao, limite, ignorarWebhook } = corpo.data;

  if (!simulacao && !ignorarWebhook) {
    const faltando = await webhookIncompleto();
    if (faltando.length) {
      return NextResponse.json(
        {
          error: `Conserte o webhook antes: faltam ${faltando.join(", ")}. Sem isso o clique continua não chegando e o resgate não resolve.`,
          faltando,
        },
        { status: 409 }
      );
    }
  }

  const r = await resgatarGates({ simulacao, limite });
  return NextResponse.json(r);
}
