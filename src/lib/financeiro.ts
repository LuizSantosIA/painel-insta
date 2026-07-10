// Lógica de negócio financeiro — funções puras, sem dependências de framework.
// Testável isoladamente com vitest.

export type ReceitaLike = {
  tipo: string;
  status: string;
  valorCentavos: number;
  linha?: string;
};

export type DespesaMes = { totalCentavos: number };

/** MRR = recorrentes confirmadas ou recebidas na competência. */
export function calcMRR(receitas: ReceitaLike[]): number {
  return receitas
    .filter(
      (r) =>
        r.tipo === "RECORRENTE" &&
        (r.status === "CONFIRMADA" || r.status === "RECEBIDA"),
    )
    .reduce((s, r) => s + r.valorCentavos, 0);
}

/** MRR por linha de receita — retorna { INNOBI, MENTORIA, SERVICOS }. */
export function calcMRRPorLinha(
  receitas: ReceitaLike[],
): Record<string, number> {
  const acc: Record<string, number> = { INNOBI: 0, MENTORIA: 0, SERVICOS: 0 };
  receitas
    .filter(
      (r) =>
        r.tipo === "RECORRENTE" &&
        (r.status === "CONFIRMADA" || r.status === "RECEBIDA"),
    )
    .forEach((r) => {
      if (r.linha && r.linha in acc) acc[r.linha] += r.valorCentavos;
    });
  return acc;
}

/** Receita pontual do período (não entra no MRR). */
export function calcReceitaPontual(receitas: ReceitaLike[]): number {
  return receitas
    .filter((r) => r.tipo === "PONTUAL")
    .reduce((s, r) => s + r.valorCentavos, 0);
}

/** Receitas confirmadas ainda não recebidas. */
export function calcAReceber(receitas: ReceitaLike[]): number {
  return receitas
    .filter((r) => r.status === "CONFIRMADA")
    .reduce((s, r) => s + r.valorCentavos, 0);
}

/**
 * Runway em meses inteiros.
 * Retorna null se houver menos de 3 meses de despesas ou média = 0.
 * NUNCA extrapola com dados insuficientes.
 */
export function calcRunway(
  saldoCentavos: number,
  despesasPorMes: DespesaMes[],
): number | null {
  if (despesasPorMes.length < 3) return null;
  const media =
    despesasPorMes.reduce((s, m) => s + m.totalCentavos, 0) /
    despesasPorMes.length;
  if (media <= 0) return null;
  return Math.floor(saldoCentavos / media);
}

/** Variação percentual entre dois valores em centavos. */
export function calcVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

/** Formata centavos em R$ (apenas no cliente/render). */
export function fmtBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/** Converte input do usuário (reais pt-BR ou en-US) em centavos Int. */
export function parseBRL(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/g, "");
  // pt-BR: "1.997,50" → ponto é milhar, vírgula é decimal
  // en-US: "1997.50"  → ponto é decimal
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  return Math.round(parseFloat(normalized || "0") * 100);
}

/** Retorna o Date UTC do primeiro dia do mês a partir de "yyyy-MM". */
export function mesParaDate(mes: string): Date {
  const [year, month] = mes.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Retorna "yyyy-MM" a partir de um Date. */
export function dateParaMes(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Retorna os últimos N meses (incluindo atual) como "yyyy-MM". */
export function ultimosMeses(n: number): string[] {
  const agora = new Date();
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1));
    meses.push(dateParaMes(d));
  }
  return meses;
}
