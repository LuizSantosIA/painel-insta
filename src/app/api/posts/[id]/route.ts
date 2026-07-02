import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: { category?: string | null } = {};
  if ("category" in body) {
    data.category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  try {
    const post = await prisma.post.update({ where: { id }, data });
    return NextResponse.json({ ok: true, post });
  } catch {
    return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  }
}