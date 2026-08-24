"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

/**
 * Ação rápida do cabeçalho.
 *
 * Hoje cada item leva para a tela onde o formulário já existe — nenhum fluxo novo
 * de criação foi inventado. Quando houver um modal de criação compartilhado, basta
 * trocar `href` por `onSelect` nesta lista: o resto do componente não muda.
 */
interface AcaoRapida {
  label: string;
  descricao: string;
  href: string;
}

const ACOES: AcaoRapida[] = [
  { label: "Cliente", descricao: "Cadastrar na carteira", href: "/negocio/clientes" },
  { label: "Lead", descricao: "Nova oportunidade no pipeline", href: "/negocio/pipeline" },
  { label: "Receita", descricao: "Lançar entrada no mês", href: "/negocio/financeiro" },
  { label: "Tarefa", descricao: "Pendência com prazo", href: "/negocio/tarefas" },
  { label: "Compromisso", descricao: "Promessa feita a alguém", href: "/negocio/compromissos" },
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
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-foreground-2 transition-colors hover:border-brand/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Novo
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[228px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          {ACOES.map((acao) => (
            <Link
              key={acao.label}
              href={acao.href}
              role="menuitem"
              onClick={() => setAberto(false)}
              className="block border-b border-border-subtle px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
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
