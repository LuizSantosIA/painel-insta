import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const [posts, snapshots] = await Promise.all([
    prisma.post.deleteMany({ where: { source: "manual" } }),
    prisma.accountSnapshot.deleteMany({}),
  ]);
  return NextResponse.json({ deleted: posts.count, snapshotsDeleted: snapshots.count });
}