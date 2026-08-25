import { getAllPosts } from "@/lib/data";
import { AutoManager } from "@/components/auto-manager";
import { AutomacoesResultado } from "@/components/maquina/automacoes-resultado";
import { Section, SectionHeader } from "@/components/negocio/panel";
import { Zap } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Automações.
 *
 * A tela abre pelo resultado e só depois pela configuração — a pergunta que
 * importa é "isso está gerando negócio?", não "quantas regras eu tenho". O
 * gerenciador de regras é exatamente o mesmo de antes, sem nada removido.
 */
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
    <div className="space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Automações</h1>
        <p className="mt-0.5 text-[12px] text-muted">
          Palavra-chave vira conversa sozinha — e a conversa precisa virar negócio
        </p>
      </header>

      <AutomacoesResultado />

      <Section>
        <SectionHeader titulo="Regras" meta={`${postList.length} posts disponíveis`} />

        {postList.length === 0 ? (
          <div className="flex items-baseline gap-2 py-2.5">
            <Zap className="h-[13px] w-[13px] shrink-0 translate-y-[2px] text-muted-2" />
            <span className="text-[12px] font-medium text-foreground-2">
              Nenhum post sincronizado
            </span>
            <span className="text-[12px] text-muted">
              Sincronize a conta em Integrações para criar regras.
            </span>
          </div>
        ) : (
          <div className="max-w-2xl pt-4">
            <AutoManager posts={postList} />
          </div>
        )}
      </Section>
    </div>
  );
}
