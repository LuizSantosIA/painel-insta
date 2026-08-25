import { Label, TRACO } from "./panel";

export interface BusinessMetricProps {
  label: string;
  valor: string | null;
  /** Linha de apoio abaixo do número. */
  auxiliar: string | null;
  /** Colore só a linha auxiliar — o número principal permanece neutro. */
  tomAuxiliar?: "positivo" | "negativo" | "neutro";
  /** Mostrado quando não há valor: explica a ausência em vez de deixar vazio. */
  vazioDica?: string;
}

/**
 * Um indicador da faixa executiva.
 *
 * As três linhas têm altura fixa para os quatro indicadores alinharem na
 * horizontal, independente de o auxiliar existir ou quebrar. O "—" ocupa a mesma
 * caixa do número: ausência de dado, não componente quebrado.
 */
export function BusinessMetric({
  label,
  valor,
  auxiliar,
  tomAuxiliar = "neutro",
  vazioDica,
}: BusinessMetricProps) {
  const temValor = valor !== null;

  const corAux = {
    positivo: "text-[color:var(--success)]",
    negativo: "text-[color:var(--danger)]",
    neutro: "text-muted",
  }[tomAuxiliar];

  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 px-4 py-3.5 lg:px-5">
      <Label>{label}</Label>

      <span className="flex h-[27px] items-end">
        <span
          className={`text-[27px] font-semibold leading-none tracking-tight tabular-nums ${
            temValor ? "text-foreground" : "text-muted-2"
          }`}
        >
          {temValor ? valor : TRACO}
        </span>
      </span>

      <p className={`h-[15px] truncate text-[11px] leading-[15px] ${temValor ? corAux : "text-muted-2"}`}>
        {temValor ? (auxiliar ?? "") : (vazioDica ?? "")}
      </p>
    </div>
  );
}

/** Classes de coluna no desktop. Escritas por extenso porque o Tailwind não gera
 *  classe a partir de string interpolada. */
const COLUNAS_LG: Record<number, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/**
 * Faixa horizontal de KPIs — a única área que mantém container, porque aqui o
 * agrupamento é a informação. Divisores verticais no desktop; 2x2 no tablet;
 * empilhada no mobile.
 */
export function MetricStrip({
  metricas,
  colunas = 4,
}: {
  metricas: BusinessMetricProps[];
  /** Quantas colunas no desktop. A Máquina usa 5; o Negócio, 4. */
  colunas?: 3 | 4 | 5;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface/40">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${COLUNAS_LG[colunas]}`}>
        {metricas.map((m, i) => (
          <div
            key={m.label}
            className={[
              i > 0 ? "border-t border-border-subtle" : "",
              "sm:border-t-0",
              i >= 2 ? "sm:border-t sm:border-border-subtle" : "",
              "lg:border-t-0",
              i % 2 === 1 ? "sm:border-l sm:border-border-subtle" : "",
              i > 0 ? "lg:border-l lg:border-border-subtle" : "",
            ].join(" ")}
          >
            <BusinessMetric {...m} />
          </div>
        ))}
      </div>
    </div>
  );
}
