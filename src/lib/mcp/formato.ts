/**
 * Formatação do texto que o MCP devolve.
 *
 * Quem lê a saída é um modelo — possivelmente um modelo local pequeno rodando
 * no Jarvis. Então: denso, em português, sem tabela ASCII, sem JSON cru, e com
 * o id ao lado do nome sempre que a próxima pergunta puder precisar dele.
 */

export function dinheiro(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function data(d: Date | string | null | undefined): string {
  if (!d) return "sem data";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function dataHora(d: Date | string | null | undefined): string {
  if (!d) return "sem data";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "há 3 dias", "hoje", "em 5 dias" — relativo a agora. */
export function quando(d: Date | string | null | undefined, agora = new Date()): string {
  if (!d) return "sem data";
  const dt = typeof d === "string" ? new Date(d) : d;
  const dias = Math.round((dt.getTime() - agora.getTime()) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

/** Corta sem partir palavra no meio. */
export function resumir(texto: string | null | undefined, limite = 120): string {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= limite) return t;
  const corte = t.slice(0, limite);
  const espaco = corte.lastIndexOf(" ");
  return `${espaco > limite * 0.6 ? corte.slice(0, espaco) : corte}…`;
}

/** Lista com marcador, ou uma linha dizendo que não há nada. */
export function lista(itens: string[], vazio: string): string {
  return itens.length ? itens.map((i) => `- ${i}`).join("\n") : vazio;
}

/** Junta seções não vazias com uma linha em branco entre elas. */
export function secoes(...partes: (string | null | undefined | false)[]): string {
  return partes.filter((p): p is string => typeof p === "string" && p.trim().length > 0).join("\n\n");
}

export function titulo(t: string): string {
  return `## ${t}`;
}

/** "3 posts" / "1 post" — concordância sem gambiarra na chamada. */
export function plural(n: number, singular: string, pluralForma = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
