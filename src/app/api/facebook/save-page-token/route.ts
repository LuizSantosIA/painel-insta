import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pageToken: string = body.pageToken?.trim() ?? "";

  if (!pageToken) {
    return NextResponse.json({ error: "pageToken é obrigatório" }, { status: 400 });
  }

  // Verifica e obtém o ID da Página usando o próprio page token
  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${pageToken}`
  );
  const meData = await meRes.json();

  if (!meRes.ok || meData.error) {
    return NextResponse.json(
      { error: meData.error?.message ?? "Token inválido — verifique se é um Page Access Token" },
      { status: 400 }
    );
  }

  const pageId: string = meData.id;
  const pageName: string = meData.name ?? "Página";

  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent
    .replace(/^FB_PAGE_ID=.*/m, `FB_PAGE_ID="${pageId}"`)
    .replace(/^FB_PAGE_ACCESS_TOKEN=.*/m, `FB_PAGE_ACCESS_TOKEN="${pageToken}"`);
  fs.writeFileSync(envPath, envContent);
  process.env.FB_PAGE_ID = pageId;
  process.env.FB_PAGE_ACCESS_TOKEN = pageToken;

  // Assina a página para receber webhooks de mensagens
  await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=messages,feed&access_token=${pageToken}`,
    { method: "POST" }
  ).catch(() => {});

  return NextResponse.json({ ok: true, pageName });
}
