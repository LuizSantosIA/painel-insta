import { Label, TRACO, Valor } from "./panel";

export interface BusinessMetricProps {
  label: string;
  valor: string | null;
  /** Linha de apoio abaixo do número. Null vira uma dica contextual apagada. */
  auxiliar: string | null;
  /** Colore só a linha auxiliar — o número principal permanece neutro. */
  tomAuxiliar?: "positivo" | "negativo" | "neutro";
  /** Mostrado quando não há valor: explica a ausência em vez de deixar vazio. */
  vazioDica?: string;
}

/** Um indicador da faixa executiva. Sem card próprio: quem separa é o divisor da faixa. */
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
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-4 lg:px-5">
      <Label>{label}</Label>
      {temValor ? (
        <Valor tamanho="lg">{valor}</Valor>
      ) : (
        <span className="text-[24px] font-semibold tracking-tight text-muted-2">{TRACO}</span>
      )}
      <p className={`truncate text-[11px] ${temValor ? corAux : "text-muted-2"}`}>
        {temValor ? (auxiliar ?? "") : (vazioDica ?? "")}
      </p>
    </div>
  );
}

/**
 * Faixa horizontal de KPIs. Divisores verticais no desktop; no tablet vira 2x2
 * (com divisores horizontais entre as linhas) e no mobile empilha.
 */
export function MetricStrip({ metricas }: { metricas: BusinessMetricProps[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border-subtle bg-surface/45">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {metricas.map((m, i) => (
          <div
            key={m.label}
            className={[
              // divisor horizontal entre linhas empilhadas
              i > 0 ? "border-t border-border-subtle" : "",
              "sm:border-t-0",
              i >= 2 ? "sm:border-t sm:border-border-subtle" : "",
              "lg:border-t-0",
              // divisor vertical
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
