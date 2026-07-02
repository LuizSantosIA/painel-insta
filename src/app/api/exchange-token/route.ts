import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const shortToken: string = body.token ?? process.env.IG_ACCESS_TOKEN ?? "";

  const appId = process.env.IG_INSTAGRAM_APP_ID ?? process.env.IG_APP_ID;
  const appSecret = process.env.IG_INSTAGRAM_APP_SECRET ?? process.env.IG_APP_SECRET;

  if (!shortToken || !appId || !appSecret) {
    return NextResponse.json(
      { error: "Token, IG_INSTAGRAM_APP_ID e IG_INSTAGRAM_APP_SECRET precisam estar preenchidos." },
      { status: 400 }
    );
  }

  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || !data.access_token) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Falha na troca de token" },
      { status: 400 }
    );
  }

  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(
    /^IG_ACCESS_TOKEN=.*/m,
    `IG_ACCESS_TOKEN="${data.access_token}"`
  );
  fs.writeFileSync(envPath, envContent);
  process.env.IG_ACCESS_TOKEN = data.access_token;

  const days = Math.round((data.expires_in ?? 0) / 86400);
  return NextResponse.json({ days, token: data.access_token });
}