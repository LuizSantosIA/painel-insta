import "server-only";
import { prisma } from "@/lib/prisma";
import type { PostLike } from "@/lib/metrics";

export async function getAllPosts(): Promise<PostLike[]> {
  const posts = await prisma.post.findMany({
    orderBy: { postedAt: "desc" },
  });
  return posts;
}

export async function getAccountSnapshots() {
  return prisma.accountSnapshot.findMany({ orderBy: { date: "asc" } });
}

export async function getPostCount(): Promise<number> {
  return prisma.post.count();
}