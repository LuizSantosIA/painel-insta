import { NextRequest, NextResponse } from "next/server";
import { tokenAtual } from "@/lib/instagram-credenciais";
import { CAMPOS_WEBHOOK, camposFaltando } from "@/lib/instagram-token";
import { autorizar } from "@/lib/mcp/token";

/**
 * Confere e conserta os campos de webhook inscritos na conta.
 *
 * Existe porque a inscrição pode ficar incompleta sem nenhum sintoma visível:
 * em 08/11/2026 faltava `messaging_postbacks` e o clique em "Seguindo" não
 * chegava ao servidor — 594 pessoas pediram material e nunca receberam, sem
 * um único erro no log.
 *
 * GET  → o que está inscrito e o que falta
 * POST → inscreve os campos que faltam (exige o token do painel)
 */

async function inscritos(): Promise<string[]> {
  const { token, userId } = await tokenAtual();
  const r = await fetch(`https://graph.instagram.com/v23.0/${userId}/subscribed_apps?access_token=${token}`);
  const j = (await r.json()) as { data?: { subscribed_fields?: string[] }[]; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "falha ao ler a inscrição");
  return j.data?.[0]?.subscribed_fields ?? [];
}

export async function GET() {
  try {
    const atuais = await inscritos();
    const faltando = camposFaltando(atuais);
    return NextResponse.json({
      inscritos: atuais,
      esperados: CAMPOS_WEBHOOK.split(","),
      faltando,
      ok: faltando.length === 0,
      aviso: faltando.includes("messaging_postbacks")
        ? "Sem messaging_postbacks o clique nos botões não chega: a trava de seguidor nunca entrega o link."
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const v = autorizar(req.headers);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: v.status });

  try {
    const { token, userId } = await tokenAtual();
    const r = await fetch(
      `https://graph.instagram.com/v23.0/${userId}/subscribed_apps?subscribed_fields=${CAMPOS_WEBHOOK}&access_token=${token}`,
      { method: "POST" }
    );
    const j = (await r.json()) as { success?: boolean; error?: { message?: string } };
    if (!r.ok || j.error) {
      return NextResponse.json({ error: j.error?.message ?? `HTTP ${r.status}` }, { status: 502 });
    }
    const atuais = await inscritos();
    return NextResponse.json({ ok: true, inscritos: atuais, faltando: camposFaltando(atuais) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
