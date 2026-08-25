"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { LABEL_INTERACAO, TIPOS_MANUAIS } from "@/lib/cliente-360";
import { isContato } from "@/lib/saude";

/**
 * "Registrar contato" — uma ação, vários reflexos.
 *
 * Grava uma interação na mesma infraestrutura do CRM 360°: entra na timeline do
 * cliente, atualiza o último contato, e com isso a saúde é recalculada na próxima
 * leitura — em Saúde, na lista de Clientes, no perfil e no painel. Não existe
 * "marcar contato" em lugar nenhum além daqui.
 */

/** "2026-08-24T14:30" no fuso local, formato do input datetime-local. */
function agoraLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function RegistrarContato({
  clienteId,
  clienteNome,
  modo,
  onFechar,
  onRegistrado,
}: {
  clienteId: string;
  clienteNome: string;
  /** CONTATO grava uma conversa; OBSERVACAO grava uma nota na timeline. */
  modo: "CONTATO" | "OBSERVACAO";
  onFechar: () => void;
  onRegistrado: () => void;
}) {
  const contato = modo === "CONTATO";
  const [tipo, setTipo] = useState(contato ? "WHATSAPP" : "NOTA");
  const [nota, setNota] = useState("");
  const [quando, setQuando] = useState(agoraLocal());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tipos = TIPOS_MANUAIS.filter((t) => (contato ? isContato(t) : t === "NOTA"));

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/clients/${clienteId}/interacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          nota: nota.trim(),
          ocorreuEm: new Date(quando).toISOString(),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErro(json.error ?? "Não foi possível salvar.");
        return;
      }
      onRegistrado();
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onFechar} />

      <div className="relative w-full max-w-[420px] rounded-[14px] border border-border bg-surface p-4 shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
              {contato ? "Registrar contato" : "Adicionar observação"}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted">{clienteNome}</p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="-mr-1 rounded-md p-1 text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {contato && (
            <div className="flex flex-wrap gap-1.5">
              {tipos.map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45 ${
                    tipo === t
                      ? "bg-foreground text-background"
                      : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {LABEL_INTERACAO[t]}
                </button>
              ))}
            </div>
          )}

          <textarea
            autoFocus
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder={
              contato ? "Nota (opcional) — o que ficou combinado?" : "O que você quer registrar?"
            }
            className="w-full resize-none rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none transition-colors duration-150 placeholder:text-muted-2 focus:border-brand/50"
          />

          <label className="flex items-center justify-between gap-2 text-[11px] text-muted-2">
            Quando
            <input
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
              className="rounded-[8px] border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
            />
          </label>

          {erro && <p className="text-[11px] text-[color:var(--danger)]">{erro}</p>}

          <div className="flex justify-end gap-2 pt-0.5">
            <button
              onClick={onFechar}
              className="rounded-[9px] border border-border px-3 py-1.5 text-[12px] text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando || (!contato && !nota.trim())}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-brand/40 bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 disabled:opacity-50"
            >
              {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
