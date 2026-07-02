import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  if (error || !code) {
    return NextResponse.redirect(`${base}/integracao?error=cancelled`);
  }

  const appId = process.env.IG_INSTAGRAM_APP_ID ?? process.env.IG_APP_ID!;
  const appSecret = process.env.IG_INSTAGRAM_APP_SECRET ?? process.env.IG_APP_SECRET!;
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

  // Salva no .env
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(
    /^IG_ACCESS_TOKEN=.*/m,
    `IG_ACCESS_TOKEN="${longData.access_token}"`
  );
  fs.writeFileSync(envPath, envContent);
  process.env.IG_ACCESS_TOKEN = longData.access_token;

  // Ativa o recebimento de webhooks para este usuário
  const igUserId = tokenData.user_id ?? "";
  if (igUserId) {
    await fetch(
      `https://graph.instagram.com/v21.0/${igUserId}/subscribed_apps?subscribed_fields=comments,messages&access_token=${longData.access_token}`,
      { method: "POST" }
    ).catch(() => {});
  }

  const days = Math.round((longData.expires_in ?? 0) / 86400);
  return NextResponse.redirect(`${base}/integracao?success=${days}`);
}