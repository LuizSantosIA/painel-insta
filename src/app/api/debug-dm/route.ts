import { NextRequest, NextResponse } from "next/server";
import { sendDmToCommenter } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const { commentId, message } = await req.json();
  try {
    await sendDmToCommenter(commentId, message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}