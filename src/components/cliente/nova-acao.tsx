"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { LABEL_INTERACAO, TIPOS_MANUAIS } from "@/lib/cliente-360";

/**
 * "+ Nova ação" do perfil.
 *
 * Tarefa, compromisso e interação são criados aqui mesmo, batendo nas APIs que já
 * existem (/api/tasks, /api/compromissos, /api/clients/[id]/interacoes) e já
 * vinculados ao cliente. Oportunidade e receita levam para as telas donas do
 * recurso, porque os formulários de lá têm campos obrigatórios que um mini-form
 * perderia — melhor mandar para o fluxo real do que criar registro incompleto.
 */

type Composer = "TAREFA" | "COMPROMISSO" | "INTERACAO" | null;

function hojeLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function NovaAcao({
  clienteId,
  clienteNome,
  onCriado,
}: {
  clienteId: string;
  clienteNome: string;
  onCriado: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [composer, setComposer] = useState<Composer>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function fora(e: MouseEvent) {
      if (!container.current?.contains(e.target as Node)) setMenuAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menuAberto]);

  const itemBase =
    "block w-full px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none border-b border-border-subtle last:border-b-0";

  return (
    <>
      <div ref={container} className="relative">
        <button
          onClick={() => setMenuAberto((v) => !v)}
          aria-expanded={menuAberto}
          aria-haspopup="menu"
          className={`inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 active:scale-[0.98] ${
            menuAberto
              ? "border-brand/45 bg-brand/10 text-foreground"
              : "border-border bg-surface-2/70 text-foreground-2 hover:border-brand/35 hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova ação
        </button>

        {menuAberto && (
          <div
            role="menu"
            className="absolute right-0 z-40 mt-1.5 w-[232px] overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
          >
            {[
              { chave: "TAREFA" as const, label: "Nova tarefa", desc: "Algo que ainda precisa acontecer" },
              { chave: "COMPROMISSO" as const, label: "Novo compromisso", desc: "Promessa com prazo" },
              { chave: "INTERACAO" as const, label: "Registrar interação", desc: "Algo que já aconteceu" },
            ].map((op) => (
              <button
                key={op.chave}
                role="menuitem"
                className={itemBase}
                onClick={() => {
                  setComposer(op.chave);
                  setMenuAberto(false);
                }}
              >
                <p className="text-[12px] font-medium text-foreground">{op.label}</p>
                <p className="mt-0.5 text-[11px] text-muted">{op.desc}</p>
              </button>
            ))}

            <Link
              href={`/negocio/pipeline?novo=1&cliente=${clienteId}`}
              role="menuitem"
              className={itemBase}
              onClick={() => setMenuAberto(false)}
            >
              <p className="text-[12px] font-medium text-foreground">Nova oportunidade</p>
              <p className="mt-0.5 text-[11px] text-muted">Abre o pipeline</p>
            </Link>
            <Link
              href={`/negocio/financeiro?novo=1&cliente=${clienteId}`}
              role="menuitem"
              className={itemBase}
              onClick={() => setMenuAberto(false)}
            >
              <p className="text-[12px] font-medium text-foreground">Nova receita</p>
              <p className="mt-0.5 text-[11px] text-muted">Abre o financeiro</p>
            </Link>
          </div>
        )}
      </div>

      {composer && (
        <Composers
          tipo={composer}
          clienteId={clienteId}
          clienteNome={clienteNome}
          onFechar={() => setComposer(null)}
          onCriado={() => {
            setComposer(null);
            onCriado();
          }}
        />
      )}
    </>
  );
}

function Composers({
  tipo,
  clienteId,
  clienteNome,
  onFechar,
  onCriado,
}: {
  tipo: Exclude<Composer, null>;
  clienteId: string;
  clienteNome: string;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(hojeLocal());
  const [tipoInteracao, setTipoInteracao] = useState<string>("WHATSAPP");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const config = {
    TAREFA: { titulo: "Nova tarefa", placeholder: "O que precisa ser feito?", rotuloData: "Prazo" },
    COMPROMISSO: { titulo: "Novo compromisso", placeholder: "O que você prometeu?", rotuloData: "Prazo" },
    INTERACAO: { titulo: "Registrar interação", placeholder: "O que aconteceu?", rotuloData: "Quando" },
  }[tipo];

  async function salvar() {
    if (!titulo.trim()) {
      setErro("Preencha a descrição.");
      return;
    }
    setSalvando(true);
    setErro(null);

    try {
      let res: Response;

      if (tipo === "TAREFA") {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titulo.trim(),
            dueDate: data ? new Date(`${data}T12:00:00`).toISOString() : null,
            clientId: clienteId,
          }),
        });
      } else if (tipo === "COMPROMISSO") {
        res = await fetch("/api/compromissos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descricao: titulo.trim(),
            para: clienteNome,
            prazoEm: new Date(`${data}T12:00:00`).toISOString(),
            clienteId,
          }),
        });
      } else {
        res = await fetch(`/api/clients/${clienteId}/interacoes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: tipoInteracao,
            nota: titulo.trim(),
            ocorreuEm: new Date(`${data}T12:00:00`).toISOString(),
          }),
        });
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErro(json.error ?? "Não foi possível salvar.");
        return;
      }
      onCriado();
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-border bg-surface/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-foreground">{config.titulo}</p>
        <button
          onClick={onFechar}
          className="text-[11px] text-muted transition-colors duration-150 hover:text-foreground"
        >
          Cancelar
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {tipo === "INTERACAO" && (
          <select
            value={tipoInteracao}
            onChange={(e) => setTipoInteracao(e.target.value)}
            className="rounded-[8px] border border-border bg-surface-2 px-2 py-1.5 text-[12px] outline-none focus:border-brand/50"
          >
            {TIPOS_MANUAIS.map((t) => (
              <option key={t} value={t}>
                {LABEL_INTERACAO[t]}
              </option>
            ))}
          </select>
        )}

        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
          placeholder={config.placeholder}
          className="min-w-[180px] flex-1 rounded-[8px] border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted-2 focus:border-brand/50"
        />

        <label className="flex items-center gap-1.5 text-[11px] text-muted-2">
          {config.rotuloData}
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-[8px] border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
          />
        </label>

        <button
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand/40 bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-brand/20 disabled:opacity-50"
        >
          {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
          Salvar
        </button>
      </div>

      {erro && <p className="mt-2 text-[11px] text-[color:var(--danger)]">{erro}</p>}
    </div>
  );
}
