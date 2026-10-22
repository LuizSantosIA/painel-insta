import { NextRequest, NextResponse } from "next/server";
import { salvarCredenciais } from "@/lib/instagram-credenciais";
import { envAlgum, urlBase } from "@/lib/env";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const base = urlBase();

  if (error || !code) {
    return NextResponse.redirect(`${base}/integracao?error=cancelled`);
  }

  const appId = envAlgum("IG_INSTAGRAM_APP_ID", "IG_APP_ID");
  const appSecret = envAlgum("IG_INSTAGRAM_APP_SECRET", "IG_APP_SECRET");
  const redirectUri = `${base}/api/auth/callback`;

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    const msg = encodeURIComponent(tokenData?.error_message ?? tokenData?.error?.message ?? "Erro ao obter token");
    return NextResponse.redirect(`${base}/integracao?error=${msg}`);
  }

  // Troca por token de longa duração (60 dias)
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", tokenData.access_token);

  const longRes = await fetch(longUrl.toString());
  const longData = await longRes.json();

  if (!longRes.ok || !longData.access_token) {
    const msg = encodeURIComponent(longData?.error?.message ?? "Erro ao renovar token");
    return NextResponse.redirect(`${base}/integracao?error=${msg}`);
  }

  // Salva no banco. Antes isto escrevia no .env — que na Vercel é efêmero e
  // somente leitura, então a reconexão em produção nunca persistia.
  const igUserId = String(tokenData.user_id ?? "");

  // O @ da conta entra junto: é com ele que o webhook reconhece um comentário
  // feito por ela mesma e evita responder ao próprio texto.
  const eu = await fetch(
    `https://graph.instagram.com/v23.0/me?fields=id,username&access_token=${longData.access_token}`
  )
    .then((r) => r.json())
    .catch(() => null);

  await salvarCredenciais({
    token: longData.access_token,
    userId: igUserId || (eu?.id ? String(eu.id) : undefined),
    username: typeof eu?.username === "string" ? eu.username : undefined,
    expiraEmSegundos: longData.expires_in,
  });
  if (igUserId) {
    await fetch(
      `https://graph.instagram.com/v21.0/${igUserId}/subscribed_apps?subscribed_fields=comments,messages&access_token=${longData.access_token}`,
      { method: "POST" }
    ).catch(() => {});
  }

  const days = Math.round((longData.expires_in ?? 0) / 86400);
  return NextResponse.redirect(`${base}/integracao?success=${days}`);
}