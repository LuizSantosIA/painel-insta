"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import {
  COR_STATUS_CONTEUDO,
  LABEL_STATUS_CONTEUDO,
  METRICAS_CONTEUDO,
  ordenarConteudos,
  STATUS_CONTEUDO,
  type MetricaConteudo,
} from "@/lib/maquina";
import type { ConteudoMaquina } from "@/lib/maquina-dados";
import type { ConteudoLista } from "@/app/api/maquina/conteudo/route";
import { PostThumb } from "@/components/post-media";
import { Section, SectionHeader, TRACO } from "@/components/negocio/panel";
import { SectionSkeleton } from "@/components/negocio/skeletons";
import { NovoConteudo } from "@/components/maquina/novo-conteudo";
import { PostsTable, type PostRow } from "@/components/posts-table";
import { HashtagTable } from "@/components/hashtag-table";

/**
 * Central de conteúdo.
 *
 * A tabela é ordenada por métrica de negócio — leads, conversas, oportunidades,
 * receita — e não por curtida. Curtida e alcance continuam ali como contexto, à
 * direita, onde o olho passa por último de propósito.
 *
 * As análises detalhadas de sempre (tabela completa de métricas e hashtags)
 * continuam na tela, embaixo, num bloco que se abre quando alguém quiser.
 */

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function titulo(c: ConteudoMaquina): string {
  return c.caption?.trim() || "Sem legenda";
}

function paraPostRow(c: ConteudoMaquina): PostRow {
  return {
    id: c.id,
    caption: c.caption,
    mediaType: c.mediaType,
    category: c.category,
    permalink: c.permalink,
    thumbnailUrl: c.thumbnailUrl,
    postedAt: c.postedAt,
    likes: c.likes,
    comments: c.comments,
    saves: c.saves,
    shares: c.shares,
    reach: c.reach,
    impressions: c.impressions,
    videoViews: c.videoViews,
    engagement: c.interacoes,
    engagementRate: c.taxaEngajamento,
  };
}

export default function ConteudoPage() {
  const [dados, setDados] = useState<ConteudoLista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [statusFiltro, setStatusFiltro] = useState<string>("TODOS");
  const [metrica, setMetrica] = useState<MetricaConteudo>("conversas");
  const [detalhes, setDetalhes] = useState(false);

  // Sem setState síncrono: o estado inicial já nasce carregando, e recarregar
  // depois de criar um conteúdo troca os dados sem piscar a tela inteira.
  const carregar = useCallback(() => {
    fetch("/api/maquina/conteudo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((json: ConteudoLista) => {
        setDados(json);
        setErro(false);
      })
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(carregar, [carregar]);

  const lista = useMemo(() => {
    if (!dados) return [];
    const filtrada =
      statusFiltro === "TODOS"
        ? dados.conteudos
        : dados.conteudos.filter((c) => c.status === statusFiltro);
    return ordenarConteudos(filtrada, metrica);
  }, [dados, statusFiltro, metrica]);

  const publicados = useMemo(
    () => (dados?.conteudos ?? []).filter((c) => c.status === "PUBLICADO"),
    [dados]
  );

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Conteúdo</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            Da ideia ao resultado — o que cada conteúdo gerou de negócio
          </p>
        </div>
        <NovoConteudo onCriado={carregar} />
      </header>

      {carregando && <SectionSkeleton linhas={6} />}

      {!carregando && erro && (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-danger/25 bg-danger/8 px-4 py-3.5 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível carregar os conteúdos. Recarregue a página.
        </div>
      )}

      {!carregando && !erro && dados && (
        <div className="space-y-6">
          {/* ── Pipeline editorial + ordenação ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip ativo={statusFiltro === "TODOS"} onClick={() => setStatusFiltro("TODOS")}>
                Todos {dados.conteudos.length}
              </Chip>
              {STATUS_CONTEUDO.map((s) => (
                <Chip
                  key={s}
                  ativo={statusFiltro === s}
                  cor={COR_STATUS_CONTEUDO[s]}
                  onClick={() => setStatusFiltro(s)}
                >
                  {LABEL_STATUS_CONTEUDO[s]} {dados.porStatus[s] ?? 0}
                </Chip>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-muted-2">
                Ordenar por
              </span>
              <select
                value={metrica}
                onChange={(e) => setMetrica(e.target.value as MetricaConteudo)}
                className="rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
              >
                {METRICAS_CONTEUDO.map((m) => (
                  <option key={m.chave} value={m.chave}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Tabela de conteúdo ── */}
          <Section>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-left">
                    <Th className="w-auto">Conteúdo</Th>
                    <Th>Data</Th>
                    <Th alinhar="right">Conversas</Th>
                    <Th alinhar="right">Leads</Th>
                    <Th alinhar="right">Oport.</Th>
                    <Th alinhar="right">Receita</Th>
                    <Th alinhar="right" contexto>
                      Interações
                    </Th>
                    <Th alinhar="right" contexto>
                      Alcance
                    </Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/70">
                  {lista.map((c) => (
                    <tr key={c.id} className="transition-colors duration-150 hover:bg-surface-2/40">
                      <td className="py-[9px] pr-3">
                        <div className="flex items-center gap-2.5">
                          <PostThumb type={c.mediaType} url={c.thumbnailUrl} size={30} />
                          <div className="min-w-0">
                            <p className="max-w-[320px] truncate text-[12.5px] text-foreground">
                              {titulo(c)}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span
                                className="inline-block h-[5px] w-[5px] rounded-full"
                                style={{ background: COR_STATUS_CONTEUDO[c.status] }}
                              />
                              <span className="text-[10px] text-muted-2">
                                {LABEL_STATUS_CONTEUDO[c.status] ?? c.status}
                                {c.category ? ` · ${c.category}` : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-[9px] pr-3 text-[11px] text-muted">
                        {fmtData(c.agendadoPara ?? c.postedAt)}
                      </td>
                      <Td valor={c.atribuicao.conversas} />
                      <Td valor={c.atribuicao.leads} destaque />
                      <Td valor={c.atribuicao.oportunidades} destaque />
                      <td className="py-[9px] pr-3 text-right text-[12px] tabular-nums">
                        {c.atribuicao.receitaCentavos > 0 ? (
                          <span className="font-medium text-[color:var(--success)]">
                            {fmtBRL(c.atribuicao.receitaCentavos)}
                          </span>
                        ) : (
                          <span className="text-muted-2">{TRACO}</span>
                        )}
                      </td>
                      <td className="py-[9px] pr-3 text-right text-[12px] tabular-nums text-muted">
                        {c.status === "PUBLICADO" ? fmtNum(c.interacoes) : TRACO}
                      </td>
                      <td className="py-[9px] pr-3 text-right text-[12px] tabular-nums text-muted">
                        {c.status === "PUBLICADO" ? fmtNum(c.alcance) : TRACO}
                      </td>
                      <td className="py-[9px] text-right">
                        {c.permalink && (
                          <a
                            href={c.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-2 transition-colors hover:text-brand"
                            title="Abrir no Instagram"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lista.length === 0 && (
              <p className="py-6 text-center text-[12px] text-muted">
                {statusFiltro === "TODOS"
                  ? "Nenhum conteúdo ainda. Sincronize o Instagram ou crie uma ideia."
                  : `Nenhum conteúdo em ${LABEL_STATUS_CONTEUDO[statusFiltro] ?? statusFiltro}.`}
              </p>
            )}
          </Section>

          {/* ── Análises detalhadas: o que a página de Posts já fazia ── */}
          <Section>
            <SectionHeader
              titulo="Métricas detalhadas"
              meta={`${publicados.length} publicados`}
            />
            <button
              onClick={() => setDetalhes((v) => !v)}
              className="-mx-2 mt-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:text-foreground-2"
            >
              {detalhes ? "Ocultar" : "Ver tabela completa, temas e hashtags"}
            </button>

            {detalhes && (
              <div className="mt-4 space-y-8">
                <PostsTable initial={publicados.map(paraPostRow)} />
                <div className="border-t border-border-subtle pt-6">
                  <HashtagTable posts={publicados.map(paraPostRow)} />
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  alinhar = "left",
  contexto = false,
  className = "",
}: {
  children?: React.ReactNode;
  alinhar?: "left" | "right";
  /** Métrica de vaidade: fica visualmente atrás das métricas de negócio. */
  contexto?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`pb-1.5 pr-3 text-[10px] font-medium uppercase tracking-[0.09em] ${
        alinhar === "right" ? "text-right" : "text-left"
      } ${contexto ? "text-muted-2/70" : "text-muted-2"} ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ valor, destaque = false }: { valor: number; destaque?: boolean }) {
  return (
    <td className="py-[9px] pr-3 text-right text-[12px] tabular-nums">
      {valor > 0 ? (
        <span className={destaque ? "font-medium text-foreground" : "text-foreground-2"}>
          {valor.toLocaleString("pt-BR")}
        </span>
      ) : (
        <span className="text-muted-2">{TRACO}</span>
      )}
    </td>
  );
}

function Chip({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 ${
        ativo
          ? "border-brand/45 bg-brand/10 text-foreground"
          : "border-border text-muted hover:border-brand/30 hover:text-foreground-2"
      }`}
    >
      {cor && (
        <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: cor }} />
      )}
      {children}
    </button>
  );
}
