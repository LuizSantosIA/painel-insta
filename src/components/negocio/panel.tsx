import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Primitivas visuais do painel de /negocio.
 *
 * A régua: seções sem caixa. O que separa é a linha do cabeçalho e o alinhamento
 * à mesma margem esquerda — não uma borda em volta de tudo. Só a faixa de KPIs
 * mantém container, porque ali o agrupamento é a informação.
 */

/** Duração única das microinterações da tela. */
export const TRANSICAO = "150ms";

export function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`min-w-0 ${className}`}>{children}</section>;
}

/**
 * Cabeçalho de seção: título à esquerda, contagem/link à direita, régua embaixo.
 * As linhas de conteúdo entram coladas nessa régua.
 */
export function SectionHeader({
  titulo,
  meta,
  href,
  hrefLabel,
}: {
  titulo: string;
  meta?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-1.5">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{titulo}</h2>
        {meta && <span className="truncate text-[11px] text-muted-2">{meta}</span>}
      </div>
      {href && (
        <Link
          href={href}
          className="group -mx-1.5 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:text-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45"
        >
          {hrefLabel ?? "Abrir"}
          <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      )}
    </header>
  );
}

/** Rótulo pequeno em caixa alta — usado acima dos números. */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-muted-2">
      {children}
    </span>
  );
}

/** Número em destaque. Tabular para as colunas não dançarem ao atualizar. */
export function Valor({
  children,
  tamanho = "md",
}: {
  children: React.ReactNode;
  tamanho?: "sm" | "md" | "lg";
}) {
  const classes = {
    sm: "text-[14px]",
    md: "text-[18px]",
    lg: "text-[27px] leading-none",
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
      className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${className}`}
      style={{ background: cor, boxShadow: `0 0 0 3px color-mix(in srgb, ${cor} 13%, transparent)` }}
    />
  );
}

export function corDoTom(tom: Tom): string {
  return CORES_TOM[tom];
}

/**
 * Estado vazio de uma linha só. Um vazio não deve custar a altura de um bloco
 * cheio — ele informa e sai da frente.
 */
export function EmptyLine({
  titulo,
  descricao,
  tom,
}: {
  titulo: string;
  descricao?: string;
  tom?: Tom;
}) {
  return (
    <div className="flex items-baseline gap-2 py-2.5">
      {tom && <Dot tom={tom} className="translate-y-[-1px]" />}
      <span className="text-[12px] font-medium text-foreground-2">{titulo}</span>
      {descricao && <span className="truncate text-[12px] text-muted">{descricao}</span>}
    </div>
  );
}

/** Classe das linhas clicáveis: hover sangra até a borda da seção. */
export const LINHA_HOVER =
  "-mx-2 rounded-md px-2 transition-colors duration-150 hover:bg-surface-2/45 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40";

/** Traço para valor inexistente — nunca zero inventado. */
export const TRACO = "—";
