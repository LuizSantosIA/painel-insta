import { getAllPosts } from "@/lib/data";
import { AutoManager } from "@/components/auto-manager";
import { Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AutomacoesPage() {
  const posts = await getAllPosts();

  const postList = posts
    .filter((p) => p.igId)
    .map((p) => ({
      id: p.id,
      igId: p.igId ?? null,
      caption: p.caption,
      mediaType: p.mediaType,
      postedAt: p.postedAt.toISOString(),
    }));

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
          <p className="text-sm text-muted">
            Responda comentários automaticamente com base em palavras-chave.
          </p>
        </div>
      </header>

      {postList.length === 0 ? (
        <div className="card p-8 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-muted" />
          <p className="font-medium">Nenhum post sincronizado</p>
          <p className="mt-1 text-sm text-muted">
            Sincronize sua conta na página de Integração para usar as automações.
          </p>
        </div>
      ) : (
        <AutoManager posts={postList} />
      )}
    </div>
  );
}