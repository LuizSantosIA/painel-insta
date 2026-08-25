import "server-only";
import { prisma } from "@/lib/prisma";
import type { PostLike } from "@/lib/metrics";

/**
 * Posts publicados — a base de todas as métricas de desempenho.
 *
 * O filtro por status existe porque o pipeline editorial passou a guardar ideia,
 * rascunho e agendado na mesma tabela. Métrica de conteúdo que ainda não foi ao ar
 * seria sempre zero e puxaria as médias para baixo. Quem precisa do pipeline
 * inteiro (calendário, central de conteúdo) usa getConteudos().
 */
export async function getAllPosts(): Promise<PostLike[]> {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLICADO" },
    orderBy: { postedAt: "desc" },
  });
  return posts;
}

/** Todo o pipeline editorial: ideias, rascunhos, agendados e publicados. */
export async function getConteudos() {
  return prisma.post.findMany({ orderBy: { postedAt: "desc" } });
}

export async function getAccountSnapshots() {
  return prisma.accountSnapshot.findMany({ orderBy: { date: "asc" } });
}

export async function getPostCount(): Promise<number> {
  return prisma.post.count({ where: { status: "PUBLICADO" } });
}
