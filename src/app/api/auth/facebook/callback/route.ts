import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  if (error || !code) {
    return NextResponse.redirect(`${base}/integracao?fb_error=cancelled`);
  }

  const appId = process.env.FB_APP_ID!;
  const appSecret = process.env.FB_APP_SECRET!;
  const redirectUri = `${base}/api/auth/facebook/callback`;

  // Troca code por user access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
  );
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    const msg = encodeURIComponent(tokenData?.error?.message ?? "Erro ao obter token Facebook");
    return NextResponse.redirect(`${base}/integracao?fb_error=${msg}`);
  }

  // Busca páginas do usuário com conta Instagram conectada
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${tokenData.access_token}`
  );
  const pagesData = await pagesRes.json();

  const page = (pagesData.data ?? []).find(
    (p: { instagram_business_account?: unknown }) => p.instagram_business_account
  );

  if (!page) {
    return NextResponse.redirect(`${base}/integracao?fb_error=sem_pagina_instagram`);
  }

  // Troca pelo token de longa duração da página (nunca expira)
  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${page.access_token}`
  );
  const longData = await longRes.json();
  const pageToken = longData.access_token ?? page.access_token;

  // Salva no .env
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");

  envContent = envContent
    .replace(/^FB_PAGE_ID=.*/m, `FB_PAGE_ID="${page.id}"`)
    .replace(/^FB_PAGE_ACCESS_TOKEN=.*/m, `FB_PAGE_ACCESS_TOKEN="${pageToken}"`);

  fs.writeFileSync(envPath, envContent);
  process.env.FB_PAGE_ID = page.id;
  process.env.FB_PAGE_ACCESS_TOKEN = pageToken;

  // Assina a página para receber webhooks de mensagens
  await fetch(
    `https://graph.facebook.com/v21.0/${page.id}/subscribed_apps?subscribed_fields=messages,feed&access_token=${pageToken}`,
    { method: "POST" }
  ).catch(() => {});

  return NextResponse.redirect(`${base}/integracao?fb_success=${encodeURIComponent(page.name)}`);
}
