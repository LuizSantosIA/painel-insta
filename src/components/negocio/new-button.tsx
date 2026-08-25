"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

/**
 * Ação rápida do cabeçalho.
 *
 * Cada item leva para a tela dona do recurso com ?novo=1, e a tela abre o próprio
 * formulário de criação já existente. Nenhum fluxo novo foi inventado e nenhum
 * formulário foi duplicado — a validação continua onde sempre esteve.
 */
interface AcaoRapida {
  label: string;
  descricao: string;
  href: string;
}

const ACOES: AcaoRapida[] = [
  { label: "Cliente", descricao: "Cadastrar na carteira", href: "/negocio/clientes?novo=1" },
  { label: "Oportunidade", descricao: "Novo lead no pipeline", href: "/negocio/pipeline?novo=1" },
  { label: "Tarefa", descricao: "Pendência com prazo", href: "/negocio/tarefas?novo=1" },
  { label: "Compromisso", descricao: "Promessa feita a alguém", href: "/negocio/compromissos?novo=1" },
  { label: "Receita", descricao: "Lançar entrada no mês", href: "/negocio/financeiro?novo=1" },
];

export function NewButton() {
  const [aberto, setAberto] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(e: MouseEvent) {
      if (!container.current?.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={container} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 active:scale-[0.98] ${
          aberto
            ? "border-brand/45 bg-brand/10 text-foreground"
            : "border-border bg-surface-2/70 text-foreground-2 hover:border-brand/35 hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
        Novo
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[224px] overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          {ACOES.map((acao) => (
            <Link
              key={acao.label}
              href={acao.href}
              role="menuitem"
              onClick={() => setAberto(false)}
              className="block border-b border-border-subtle px-3 py-2 transition-colors duration-150 last:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <p className="text-[12px] font-medium text-foreground">{acao.label}</p>
              <p className="mt-0.5 text-[11px] text-muted">{acao.descricao}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
