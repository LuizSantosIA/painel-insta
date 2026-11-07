/**
 * Quem entra na lista e quem não entra. Puro, sem banco.
 *
 * A ordem importa: opt-out antes de tudo, porque "pediu para não contatar" não
 * se discute; depois blacklist, rede nacional, avaliações de menos, e por fim
 * duplicata. Assim o motivo registrado é sempre o mais grave, não o primeiro
 * que casou por acaso.
 */

import { normalizarTelefone } from "./telefone";

export type MotivoDescarte =
  | "OPT_OUT"
  | "BLOQUEADO"
  | "REDE_NACIONAL"
  | "POUCAS_AVALIACOES"
  | "JA_NO_PIPELINE"
  | "DUPLICADO"
  | "SEM_CONTATO";

export const LABEL_DESCARTE: Record<MotivoDescarte, string> = {
  OPT_OUT: "pediu para não ser contatado",
  BLOQUEADO: "na lista de bloqueio",
  REDE_NACIONAL: "rede nacional",
  POUCAS_AVALIACOES: "poucas avaliações",
  JA_NO_PIPELINE: "já está no pipeline ou é cliente",
  DUPLICADO: "repetido nesta busca",
  SEM_CONTATO: "sem telefone utilizável",
};

/** Redes que não adianta prospectar: decisão não passa pela unidade local. */
export const REDES_PADRAO = [
  "localiza",
  "movida",
  "unidas",
  "brasal",
  "kanui",
  "webmotors",
  "loccar",
  "foco",
  "saga",
  "jaguar",
  "odontocompany",
  "oral sin",
  "sorridents",
  "imperio",
  "lopes",
  "remax",
  "re/max",
  "century 21",
];

/** Minúsculas, sem acento, espaços colapsados. */
export function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O nome é de uma rede da lista?
 *
 * Casa por palavra inteira, não por pedaço: "Movida" não pode derrubar
 * "Automovida", e "Foco" não pode derrubar "Enfoco". Para redes com nome
 * composto ("oral sin"), casa a sequência inteira.
 */
export function ehRedeNacional(nome: string, redes: string[] = REDES_PADRAO): boolean {
  const alvo = ` ${normalizarNome(nome)} `;
  return redes.some((rede) => {
    const r = normalizarNome(rede);
    return r.length > 0 && alvo.includes(` ${r} `);
  });
}

export interface Candidato {
  placeId: string;
  nome: string;
  telefone?: string | null;
  totalAvaliacoes?: number | null;
}

export interface ContextoFiltro {
  /** place_id e telefones E.164 já bloqueados ou em opt-out. */
  optOut: Set<string>;
  bloqueados: Set<string>;
  /** place_id e telefones E.164 que já estão no pipeline ou são clientes. */
  jaConhecidos: Set<string>;
  redes: string[];
  minAvaliacoes: number;
}

export interface Veredito {
  aceito: boolean;
  motivo?: MotivoDescarte;
  /** Telefone canônico, quando houver. */
  e164?: string;
}

export function avaliarCandidato(c: Candidato, ctx: ContextoFiltro): Veredito {
  const tel = normalizarTelefone(c.telefone);
  const e164 = tel?.e164;
  const chaves = [c.placeId, e164].filter((v): v is string => Boolean(v));

  if (chaves.some((k) => ctx.optOut.has(k))) return { aceito: false, motivo: "OPT_OUT", e164 };
  if (chaves.some((k) => ctx.bloqueados.has(k))) return { aceito: false, motivo: "BLOQUEADO", e164 };
  if (ehRedeNacional(c.nome, ctx.redes)) return { aceito: false, motivo: "REDE_NACIONAL", e164 };
  if ((c.totalAvaliacoes ?? 0) < ctx.minAvaliacoes) {
    return { aceito: false, motivo: "POUCAS_AVALIACOES", e164 };
  }
  if (chaves.some((k) => ctx.jaConhecidos.has(k))) return { aceito: false, motivo: "JA_NO_PIPELINE", e164 };
  if (!e164) return { aceito: false, motivo: "SEM_CONTATO", e164 };

  return { aceito: true, e164 };
}

export interface ResultadoFiltragem<T extends Candidato> {
  aceitos: (T & { e164: string })[];
  descartados: { candidato: T; motivo: MotivoDescarte }[];
  /** Quantos caíram por cada motivo — é o que a tela de execução mostra. */
  contagem: Record<MotivoDescarte, number>;
}

/**
 * Filtra o lote inteiro, deduplicando dentro dele.
 *
 * A mesma empresa aparece duas vezes quando dois termos de busca a encontram
 * ("revenda de carros" e "loja de veículos"), às vezes com place_id diferente
 * e o mesmo telefone — por isso a dedup olha as duas chaves.
 */
export function filtrarLote<T extends Candidato>(
  candidatos: T[],
  ctx: ContextoFiltro
): ResultadoFiltragem<T> {
  const aceitos: (T & { e164: string })[] = [];
  const descartados: { candidato: T; motivo: MotivoDescarte }[] = [];
  const contagem = Object.fromEntries(
    (Object.keys(LABEL_DESCARTE) as MotivoDescarte[]).map((m) => [m, 0])
  ) as Record<MotivoDescarte, number>;

  const vistos = new Set<string>();

  for (const c of candidatos) {
    const v = avaliarCandidato(c, ctx);

    if (!v.aceito) {
      contagem[v.motivo!]++;
      descartados.push({ candidato: c, motivo: v.motivo! });
      continue;
    }

    const chaves = [c.placeId, v.e164!];
    if (chaves.some((k) => vistos.has(k))) {
      contagem.DUPLICADO++;
      descartados.push({ candidato: c, motivo: "DUPLICADO" });
      continue;
    }

    for (const k of chaves) vistos.add(k);
    aceitos.push({ ...c, e164: v.e164! });
  }

  return { aceitos, descartados, contagem };
}
