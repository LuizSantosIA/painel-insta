import { NextRequest, NextResponse } from "next/server";
import { renovarToken, statusToken } from "@/lib/instagram-credenciais";

/**
 * Saúde e renovação do token do Instagram.
 *
 * O cron da Vercel chama esta rota por GET, uma vez por dia, com
 * `Authorization: Bearer $CRON_SECRET`. Autorizado, renova; sem autorização,
 * devolve só o diagnóstico — que é o que o painel lê.
 *
 * Existe porque em outubro de 2026 o token expirou em silêncio e as
 * automações pararam de responder sem nada avisar.
 */

function doCron(req: NextRequest): boolean {
  const segredo = (process.env.CRON_SECRET ?? "").trim();
  if (!segredo) return false;
  return (
    req.headers.get("authorization") === `Bearer ${segredo}` ||
    req.headers.get("x-cron-secret") === segredo
  );
}

async function renovar(req: NextRequest) {
  const forcar = req.nextUrl.searchParams.get("forcar") === "1";
  const resultado = await renovarToken(forcar);

  if (!resultado.ok) {
    // 409, não 500: o sistema está são — o token é que precisa de uma ação sua.
    return NextResponse.json(
      {
        ...resultado,
        acao: resultado.precisaReconectar
          ? "Reconecte a conta em /maquina/integracoes"
          : "Tente de novo mais tarde",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ...resultado, status: await statusToken() });
}

export async function GET(req: NextRequest) {
  if (doCron(req)) return renovar(req);
  return NextResponse.json(await statusToken());
}

/** Renovar na mão, pelo botão do painel. */
export async function POST(req: NextRequest) {
  return renovar(req);
}
