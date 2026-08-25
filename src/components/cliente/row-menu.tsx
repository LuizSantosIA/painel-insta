"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { STATUS_CLIENTE, labelStatus } from "./saude-indicator";

/**
 * Menu ••• da linha do cliente e do perfil.
 *
 * Arquivar e excluir são coisas diferentes de verdade: arquivar preenche
 * `arquivadoEm` e some da lista preservando todo o histórico; excluir apaga o
 * cliente (as interações vão junto por cascade, mas receitas, tarefas,
 * compromissos e oportunidades ficam com o vínculo zerado).
 */
export function RowMenu({
  status,
  arquivado,
  onEditar,
  onStatus,
  onArquivar,
  onExcluir,
  alinhamento = "right",
}: {
  status: string;
  arquivado: boolean;
  onEditar: () => void;
  onStatus: (novo: string) => void;
  onArquivar: () => void;
  onExcluir: () => void;
  alinhamento?: "left" | "right";
}) {
  const [aberto, setAberto] = useState(false);
  const [submenu, setSubmenu] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (!container.current?.contains(e.target as Node)) {
        setAberto(false);
        setSubmenu(false);
      }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAberto(false);
        setSubmenu(false);
      }
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function acionar(fn: () => void) {
    setAberto(false);
    setSubmenu(false);
    fn();
  }

  const itemBase =
    "block w-full px-3 py-1.5 text-left text-[12px] transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

  return (
    <div ref={container} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        aria-label="Ações do cliente"
        aria-expanded={aberto}
        aria-haspopup="menu"
        className={`rounded-md p-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45 ${
          aberto ? "bg-surface-2 text-foreground" : "text-muted-2 hover:bg-surface-2 hover:text-foreground-2"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {aberto && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 w-[184px] overflow-hidden rounded-[10px] border border-border bg-surface py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${
            alinhamento === "right" ? "right-0" : "left-0"
          }`}
        >
          <button role="menuitem" className={`${itemBase} text-foreground-2`} onClick={() => acionar(onEditar)}>
            Editar
          </button>

          <div className="relative">
            <button
              role="menuitem"
              aria-expanded={submenu}
              className={`${itemBase} flex items-center justify-between text-foreground-2`}
              onClick={() => setSubmenu((v) => !v)}
            >
              Alterar status
              <span className="text-muted-2">›</span>
            </button>
            {submenu && (
              <div className="border-y border-border-subtle bg-surface-2/40 py-1">
                {STATUS_CLIENTE.map((s) => (
                  <button
                    key={s}
                    role="menuitem"
                    disabled={s === status}
                    className={`${itemBase} pl-6 ${
                      s === status ? "cursor-default text-muted-2" : "text-foreground-2"
                    }`}
                    onClick={() => s !== status && acionar(() => onStatus(s))}
                  >
                    {labelStatus(s)}
                    {s === status && <span className="ml-1.5 text-[10px]">atual</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button role="menuitem" className={`${itemBase} text-foreground-2`} onClick={() => acionar(onArquivar)}>
            {arquivado ? "Desarquivar" : "Arquivar"}
          </button>

          <div className="my-1 border-t border-border-subtle" />

          <button
            role="menuitem"
            className={`${itemBase} text-[color:var(--danger)]`}
            onClick={() => acionar(onExcluir)}
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
