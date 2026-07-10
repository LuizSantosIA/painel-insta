import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const rascunhos = await prisma.postRascunho.findMany({
    where: status ? { status } : undefined,
    orderBy: { geradoEm: "desc" },
  });
  return NextResponse.json(rascunhos);
}
