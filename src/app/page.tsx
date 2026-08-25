"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { saudacao } from "@/lib/hoje";
import type { HojeOverview } from "@/app/api/hoje/route";
import { NewButton } from "@/components/negocio/new-button";
import {
  LinhaAgenda,
  LinhaAtencao,
  LinhaProximo,
  LinhaTarefa,
  TituloSecao,
  TudoSobControle,
  VazioCompacto,
} from "@/components/hoje/blocos";

/**
 * Hoje — camada de priorização sobre o Command Center inteiro.
 *
 * Não é dashboard: não mostra MRR, contagem de leads nem runway, porque isso já
 * vive em Negócio, Financeiro e Pipeline. Aqui só entra o que exige uma decisão.
 */

/** Quantos itens de atenção aparecem antes do "ver mais". */
const LIMITE_ATENCAO = 8;

function dataPorExtenso(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function HojePage() {
  const [dados, setDados] = useState<HojeOverview | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [versao, setVersao] = useState(0);
  const [concluindo, setConcluindo] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);

  const recarregar = useCallback(() => setVersao((n) => n + 1), []);

  useEffect(() => {
    let ativo = true;

    fetch("/api/hoje")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((json: HojeOverview) => {
        if (ativo) {
          setDados(json);
          setErro(false);
        }
      })
      .catch(() => {
        if (ativo) setErro(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [versao]);

  async function concluirTarefa(id: string) {
    setConcluindo(id);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      recarregar();
    } finally {
      setConcluindo(null);
    }
  }

  // A saudação usa a hora do navegador — o fuso de quem está olhando, não o do servidor.
  const [hora, setHora] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hora local só existe no cliente; ler no render quebraria a hidratação
    setHora(new Date().getHours());
  }, []);

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">
            {hora === null ? "Olá" : saudacao(hora)}, Chefe.
          </h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {dados ? dados.resumo : carregando ? "Lendo seu dia…" : dataPorExtenso()}
          </p>
        </div>
        <NewButton />
      </header>

      {carregando && (
        <div className="flex items-center gap-2 py-6 text-[12px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && erro && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-danger/25 bg-danger/8 px-4 py-3 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível carregar o seu dia. Recarregue a página.
        </div>
      )}

      {!carregando && !erro && dados && (
        <>
          {/* ── Sua atenção ── */}
          <section className="min-w-0">
            <TituloSecao
              titulo="Sua atenção"
              meta={
                dados.contagem.urgentes > 0
                  ? `${dados.prioridades.length} · ${dados.contagem.urgentes} urgente${dados.contagem.urgentes > 1 ? "s" : ""}`
                  : dados.prioridades.length > 0
                    ? `${dados.prioridades.length} ${dados.prioridades.length === 1 ? "item" : "itens"}`
                    : undefined
              }
            />

            {dados.prioridades.length === 0 ? (
              <TudoSobControle />
            ) : (
              <>
                <div className="divide-y divide-border-subtle/70">
                  {(expandido ? dados.prioridades : dados.prioridades.slice(0, LIMITE_ATENCAO)).map(
                    (item) => (
                      <LinhaAtencao key={item.id} item={item} />
                    )
                  )}
                </div>
                {!expandido && dados.prioridades.length > LIMITE_ATENCAO && (
                  <button
                    onClick={() => setExpandido(true)}
                    className="-mx-2 mt-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:text-foreground-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
                  >
                    Ver mais {dados.prioridades.length - LIMITE_ATENCAO} itens
                  </button>
                )}
              </>
            )}
          </section>

          {/* ── Agora / Próximo — só aparece quando há algo marcado ── */}
          {dados.agenda.length > 0 && (
            <section className="min-w-0">
              <TituloSecao
                titulo="Agora"
                meta={`${dados.agenda.length} ${dados.agenda.length === 1 ? "compromisso" : "compromissos"} hoje`}
                href="/negocio/compromissos"
                hrefLabel="Compromissos"
              />
              <div className="divide-y divide-border-subtle/70">
                {dados.agenda.map((item) => (
                  <LinhaAgenda key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* ── Tarefas do dia ── */}
          <section className="min-w-0">
            <TituloSecao
              titulo="Hoje"
              meta={dados.tarefas.length > 0 ? `${dados.tarefas.length} para fechar` : undefined}
              href="/negocio/tarefas"
              hrefLabel="Tarefas"
            />
            {dados.tarefas.length === 0 ? (
              <VazioCompacto texto="Nenhuma tarefa vence hoje." />
            ) : (
              <div className="divide-y divide-border-subtle/70">
                {dados.tarefas.map((t) => (
                  <LinhaTarefa
                    key={t.id}
                    tarefa={t}
                    concluindo={concluindo === t.id}
                    onConcluir={() => concluirTarefa(t.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Próximos dias ── */}
          {dados.proximos.length > 0 && (
            <section className="min-w-0">
              <TituloSecao titulo="Próximos" meta="próximos 7 dias" />
              <div className="divide-y divide-border-subtle/70">
                {dados.proximos.map((item) => (
                  <LinhaProximo key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
