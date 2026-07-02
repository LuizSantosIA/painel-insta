import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.WEBHOOK_VERIFY_TOKEN ?? "(vazio)";
  return NextResponse.json({
    token_preview: token.slice(0, 8) + "...",
    token_length: token.length,
  });
}
