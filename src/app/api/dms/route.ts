import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const conversations = await prisma.igConversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(conversations);
}
