import { NextResponse } from "next/server";
import { avancar } from "@/lib/engine/orquestrador";

/** Avança o post uma etapa agora, mesmo em modo MANUAL. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await avancar(id, true);
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
