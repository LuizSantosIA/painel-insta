"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { MEDIA_TYPES, mediaTypeLabel } from "@/lib/constants";
import { LABEL_STATUS_CONTEUDO } from "@/lib/maquina";

/**
 * Criação rápida de conteúdo planejado.
 *
 * Serve ao calendário e à central de conteúdo — os dois abrem o mesmo formulário,
 * então a validação de "agendado precisa de data" vive num lugar só (e é repetida
 * na API, que é quem manda de verdade).
 */

const STATUS_CRIAVEIS = ["IDEIA", "RASCUNHO", "AGENDADO"] as const;

export function NovoConteudo({
  onCriado,
  dataSugerida,
  aberto: abertoExterno,
  onFechar,
}: {
  onCriado: () => void;
  /** Data pré-preenchida quando a criação nasce de um dia do calendário. */
  dataSugerida?: string | null;
  aberto?: boolean;
  onFechar?: () => void;
}) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoExterno ?? abertoInterno;

  const [caption, setCaption] = useState("");
  const [mediaType, setMediaType] = useState<string>("REELS");
  const [status, setStatus] = useState<string>(dataSugerida ? "AGENDADO" : "IDEIA");
  const [agendadoPara, setAgendadoPara] = useState(dataSugerida ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setAbertoInterno(false);
    onFechar?.();
    setErro(null);
  }

  async function salvar() {
    if (!caption.trim()) {
      setErro("Escreva do que é o conteúdo");
      return;
    }
    if (status === "AGENDADO" && !agendadoPara) {
      setErro("Informe a data para agendar");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/maquina/conteudo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: caption.trim(),
          mediaType,
          status,
          agendadoPara: agendadoPara ? new Date(agendadoPara).toISOString() : null,
        }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setErro(json.error ?? "Não foi possível salvar");
        return;
      }
      setCaption("");
      setAgendadoPara(dataSugerida ?? "");
      fechar();
      onCriado();
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAbertoInterno(true)}
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface-2/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground-2 transition-all duration-150 hover:border-brand/35 hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 active:scale-[0.98]"
      >
        <Plus className="h-3.5 w-3.5" />
        Novo conteúdo
      </button>
    );
  }

  return (
    <div className="rounded-[12px] border border-border bg-surface/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-foreground">Novo conteúdo</p>
        <button
          onClick={fechar}
          className="rounded p-1 text-muted-2 transition-colors hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          placeholder="Do que é esse conteúdo? Ex.: 3 ferramentas de IA para empresas"
          className="w-full resize-none rounded-[9px] border border-border bg-surface-2/50 px-3 py-2 text-[12.5px] text-foreground outline-none transition-colors focus:border-brand/50"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
          >
            {STATUS_CRIAVEIS.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUS_CONTEUDO[s]}
              </option>
            ))}
          </select>

          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
          >
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>
                {mediaTypeLabel(t)}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={agendadoPara}
            onChange={(e) => setAgendadoPara(e.target.value)}
            className="rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
          />

          <button
            onClick={salvar}
            disabled={salvando}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] border border-brand/45 bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-brand/15 disabled:opacity-60"
          >
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </div>

        {erro && <p className="text-[11px] text-[color:var(--danger)]">{erro}</p>}
      </div>
    </div>
  );
}
