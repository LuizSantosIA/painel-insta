import { NextResponse } from "next/server";

export async function GET() {
  const stripBom = (v?: string) => (v ?? "").replace(/^﻿/, "").replace(/^\xEF\xBB\xBF/, "");
  const token  = stripBom(process.env.IG_ACCESS_TOKEN);
  const userId = stripBom(process.env.IG_USER_ID);

  // Testa o token chamando a API do Instagram
  let igTest: unknown = null;
  if (token) {
    try {
      const res = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${token}`,
        { signal: AbortSignal.timeout(5000) }
      );
      igTest = await res.json();
    } catch (e) {
      igTest = { error: String(e) };
    }
  }

  return NextResponse.json({
    token_preview: token ? token.slice(0, 12) + "..." : "(vazio)",
    token_length: token.length,
    userId,
    igTest,
  });
}
