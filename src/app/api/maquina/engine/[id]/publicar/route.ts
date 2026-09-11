import { NextResponse } from "next/server";
import { publicar } from "@/lib/engine/orquestrador";

/** "Publicar agora" — o clique seu que os modos MANUAL e COPILOTO exigem. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await publicar(id, true);
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
