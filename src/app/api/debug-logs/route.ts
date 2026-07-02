import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [logs, rules] = await Promise.all([
    prisma.commentLog.findMany({ orderBy: { id: "desc" }, take: 20 }),
    prisma.autoRule.findMany({ where: { isActive: true } }),
  ]);
  return NextResponse.json({ logs, rules });
}