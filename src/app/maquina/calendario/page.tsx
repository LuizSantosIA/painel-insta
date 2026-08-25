"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { COR_STATUS_CONTEUDO, LABEL_STATUS_CONTEUDO, STATUS_CONTEUDO } from "@/lib/maquina";
import type { ConteudoLista } from "@/app/api/maquina/conteudo/route";
import { CalendarView, type CalendarPost } from "@/components/calendar-view";
import { NovoConteudo } from "@/components/maquina/novo-conteudo";
import { SectionSkeleton } from "@/components/negocio/skeletons";

/**
 * Calendário editorial.
 *
 * Não é um calendário genérico: ele mostra o pipeline de conteúdo no tempo —
 * ideia, rascunho, agendado e publicado no mesmo mês. Clicar num conteúdo abre o
 * que se sabe sobre ele; clicar no "+" de um dia vazio planeja algo ali.
 */
export default function CalendarioPage() {
  const [dados, setDados] = useState<ConteudoLista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [criandoEm, setCriandoEm] = useState<string | null>(null);

  // Sem setState síncrono: já nasce carregando e o recarregar apenas troca os dados.
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

  const conteudos: CalendarPost[] = useMemo(
    () =>
      (dados?.conteudos ?? []).map((c) => ({
        id: c.id,
        status: c.status,
        caption: c.caption,
        mediaType: c.mediaType,
        thumbnailUrl: c.thumbnailUrl,
        permalink: c.permalink,
        postedAt: c.agendadoPara ?? c.postedAt,
        likes: c.likes,
        comments: c.comments,
        saves: c.saves,
        shares: c.shares,
        reach: c.reach,
        engagement: c.interacoes,
        engagementRate: c.taxaEngajamento,
      })),
    [dados]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Calendário</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            Pipeline editorial — o que está planejado e o que já foi ao ar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {dados &&
            STATUS_CONTEUDO.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span
                  className="inline-block h-[6px] w-[6px] rounded-full"
                  style={{ background: COR_STATUS_CONTEUDO[s] }}
                />
                {LABEL_STATUS_CONTEUDO[s]}
                <span className="tabular-nums text-foreground-2">{dados.porStatus[s] ?? 0}</span>
              </span>
            ))}
          <NovoConteudo onCriado={carregar} />
        </div>
      </header>

      {criandoEm && (
        <NovoConteudo
          key={criandoEm}
          aberto
          dataSugerida={`${criandoEm}T09:00`}
          onFechar={() => setCriandoEm(null)}
          onCriado={() => {
            setCriandoEm(null);
            carregar();
          }}
        />
      )}

      {carregando && <SectionSkeleton linhas={6} />}

      {!carregando && erro && (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-danger/25 bg-danger/8 px-4 py-3.5 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível carregar o calendário. Recarregue a página.
        </div>
      )}

      {!carregando && !erro && dados && (
        <CalendarView posts={conteudos} onCriarNoDia={(data) => setCriandoEm(data)} />
      )}
    </div>
  );
}
