import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Primitivas visuais do painel de /negocio.
 *
 * A régua é a mesma em todos os blocos: painel plano com borda discreta,
 * cabeçalho com título pequeno e link à direita, linhas separadas por divisores
 * de 1px em vez de cards soltos.
 */

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[14px] border border-border-subtle bg-surface/45 ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  titulo,
  subtitulo,
  href,
  hrefLabel,
}: {
  titulo: string;
  subtitulo?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-[11px] leading-snug text-muted">{subtitulo}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-brand"
        >
          {hrefLabel ?? "Abrir"}
          <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </header>
  );
}

/** Rótulo pequeno em caixa alta — usado acima dos números. */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-2">
      {children}
    </span>
  );
}

/** Número em destaque. Usa tabular-nums para as colunas não dançarem. */
export function Valor({
  children,
  tamanho = "md",
}: {
  children: React.ReactNode;
  tamanho?: "sm" | "md" | "lg";
}) {
  const classes = {
    sm: "text-[15px]",
    md: "text-[19px]",
    lg: "text-[24px]",
  }[tamanho];
  return (
    <span className={`${classes} font-semibold tracking-tight tabular-nums text-foreground`}>
      {children}
    </span>
  );
}

export type Tom = "URGENTE" | "ATENCAO" | "OK" | "NEUTRO";

const CORES_TOM: Record<Tom, string> = {
  URGENTE: "var(--danger)",
  ATENCAO: "var(--warning)",
  OK: "var(--success)",
  NEUTRO: "var(--muted-2)",
};

/** Ponto de sinalização semântica — substitui os emojis de status. */
export function Dot({ tom, className = "" }: { tom: Tom; className?: string }) {
  const cor = CORES_TOM[tom];
  return (
    <span
      aria-hidden
      className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${className}`}
      style={{ background: cor, boxShadow: `0 0 0 3px color-mix(in srgb, ${cor} 14%, transparent)` }}
    />
  );
}

export function corDoTom(tom: Tom): string {
  return CORES_TOM[tom];
}

/** Estado vazio: nunca deixar buraco morto na tela. */
export function EmptyState({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-[13px] font-medium text-foreground-2">{titulo}</p>
      {descricao && <p className="mx-auto mt-1 max-w-[280px] text-[11px] leading-relaxed text-muted">{descricao}</p>}
    </div>
  );
}

/** Traço para valor inexistente — nunca zero inventado. */
export const TRACO = "—";
