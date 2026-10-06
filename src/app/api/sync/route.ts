import { NextResponse } from "next/server";
import { isConfigured, syncInstagram } from "@/lib/instagram";

export async function POST() {
  if (!(await isConfigured())) {
    return NextResponse.json(
      {
        error:
          "Instagram não conectado. Conecte a conta em /maquina/integracoes.",
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

export async function GET() {
  return NextResponse.json({ configured: await isConfigured() });
}