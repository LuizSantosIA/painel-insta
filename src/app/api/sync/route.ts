import { NextResponse } from "next/server";
import { isConfigured, syncInstagram } from "@/lib/instagram";

export async function POST() {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          "Integração não configurada. Defina IG_ACCESS_TOKEN e IG_USER_ID no arquivo .env e reinicie o servidor.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await syncInstagram();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json({ configured: isConfigured() });
}