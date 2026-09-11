// Memória editorial e seleção — funções puras, sem dependências de framework.
//
// A memória editorial não é uma tabela nova: são os posts já publicados mais os
// aprendizados. Aqui vive o que decide "isso já foi dito?" e "qual ideia entra".

import { ORDEM_OBJETIVO, POSTS_POR_DIA, type Objetivo } from "./etapas";

// ─── Score do Estrategista ───────────────────────────────────────────────────

export interface ScoreEstrategia {
  viralidade: number;
  fit: number;
  producao: number;
  valor: number;
  conversao: number;
}

export const CAMPOS_SCORE: (keyof ScoreEstrategia)[] = [
  "viralidade",
  "fit",
  "producao",
  "valor",
  "conversao",
];

/** Média simples, 0–10, arredondada a uma casa. Pesos iguais de propósito: sem número mágico. */
export function mediaScore(s: ScoreEstrategia): number {
  const soma = CAMPOS_SCORE.reduce((acc, k) => acc + Math.min(10, Math.max(0, s[k])), 0);
  return Math.round((soma / CAMPOS_SCORE.length) * 10) / 10;
}

/** Abaixo disso a ideia não vira post — melhor 1 bom do que 3 medíocres. */
export const SCORE_MINIMO = 7;

export interface IdeiaCandidata {
  id: string;
  titulo: string;
  tema: string;
  objetivo: Objetivo;
  score: ScoreEstrategia;
}

/**
 * Escolhe até POSTS_POR_DIA ideias, uma por objetivo na ordem alcance →
 * autoridade → conversão, e só as que passam do mínimo. Se sobrar vaga e houver
 * outra ideia boa do mesmo objetivo, ela entra — nunca uma ruim para completar.
 */
export function selecionarMelhores<T extends IdeiaCandidata>(ideias: T[], limite = POSTS_POR_DIA): T[] {
  const boas = ideias
    .filter((i) => mediaScore(i.score) >= SCORE_MINIMO)
    .sort((a, b) => mediaScore(b.score) - mediaScore(a.score) || a.id.localeCompare(b.id));

  const escolhidas: T[] = [];
  const usadas = new Set<string>();

  // Primeira passada: a melhor de cada objetivo, na ordem do dia.
  for (const objetivo of ORDEM_OBJETIVO) {
    if (escolhidas.length >= limite) break;
    const melhor = boas.find((i) => i.objetivo === objetivo && !usadas.has(i.id));
    if (melhor) {
      escolhidas.push(melhor);
      usadas.add(melhor.id);
    }
  }

  // Segunda passada: preenche vagas com as melhores restantes, qualquer objetivo.
  for (const i of boas) {
    if (escolhidas.length >= limite) break;
    if (!usadas.has(i.id)) {
      escolhidas.push(i);
      usadas.add(i.id);
    }
  }

  return escolhidas;
}

// ─── Anti-repetição ──────────────────────────────────────────────────────────

const PALAVRAS_VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "um", "uma",
  "para", "com", "que", "como", "por", "no", "na", "nos", "nas", "seu", "sua",
  "eu", "meu", "minha", "the", "of", "to", "and", "in", "for", "with", "your",
]);

function tokens(texto: string): Set<string> {
  return new Set(
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !PALAVRAS_VAZIAS.has(t))
  );
}

/** Jaccard sobre palavras significativas. 0 = nada em comum, 1 = idêntico. */
export function similaridade(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comum = 0;
  for (const t of ta) if (tb.has(t)) comum++;
  return comum / (ta.size + tb.size - comum);
}

/** Acima disso, a ideia é considerada repetição de algo já publicado. */
export const LIMIAR_REPETICAO = 0.5;

export interface PostPublicadoMemoria {
  id: string;
  tituloInterno: string | null;
  tema: string | null;
  caption: string | null;
  palavraChave: string | null;
  postedAt: string | Date;
}

/** Janela em que um tema conta como "recente demais" para repetir. */
export const DIAS_MEMORIA = 60;

/**
 * Descarta candidatas parecidas com posts recentes. Compara título+tema com
 * título+tema+início da legenda de cada publicado. Devolve também o que foi
 * descartado e por quê — o Estrategista registra isso na execução.
 */
export function filtrarRepetidas<T extends { titulo: string; tema: string }>(
  candidatas: T[],
  publicados: PostPublicadoMemoria[],
  agora = new Date()
): { aceitas: T[]; descartadas: { ideia: T; parecidaCom: string; similaridade: number }[] } {
  const limite = agora.getTime() - DIAS_MEMORIA * 86_400_000;
  const recentes = publicados.filter((p) => new Date(p.postedAt).getTime() >= limite);

  const aceitas: T[] = [];
  const descartadas: { ideia: T; parecidaCom: string; similaridade: number }[] = [];

  for (const c of candidatas) {
    const textoC = `${c.titulo} ${c.tema}`;
    let pior: { id: string; sim: number } | null = null;

    for (const p of recentes) {
      const textoP = `${p.tituloInterno ?? ""} ${p.tema ?? ""} ${(p.caption ?? "").slice(0, 200)}`;
      const sim = similaridade(textoC, textoP);
      if (sim >= LIMIAR_REPETICAO && (!pior || sim > pior.sim)) pior = { id: p.id, sim };
    }

    if (pior) descartadas.push({ ideia: c, parecidaCom: pior.id, similaridade: Math.round(pior.sim * 100) / 100 });
    else aceitas.push(c);
  }

  return { aceitas, descartadas };
}

// ─── Contexto para os prompts ────────────────────────────────────────────────

export interface AprendizadoMemoria {
  texto: string;
  origem: string;
  tags: string;
  peso: number;
}

/**
 * O bloco de memória que entra nos prompts de Estrategista, Copywriter e Diretor
 * Visual. Aprendizados mais pesados primeiro; posts recentes como lista curta.
 */
export function montarContextoMemoria(
  publicados: PostPublicadoMemoria[],
  aprendizados: AprendizadoMemoria[],
  limitePosts = 15,
  limiteAprendizados = 12
): string {
  const linhas: string[] = [];

  const ordenados = [...aprendizados].sort((a, b) => b.peso - a.peso).slice(0, limiteAprendizados);
  if (ordenados.length) {
    linhas.push("APRENDIZADOS (do feedback do Luiz e da performance — respeite):");
    for (const a of ordenados) linhas.push(`- ${a.texto}${a.tags ? ` [${a.tags}]` : ""}`);
    linhas.push("");
  }

  const recentes = [...publicados]
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
    .slice(0, limitePosts);
  if (recentes.length) {
    linhas.push("JÁ PUBLICADO RECENTEMENTE (não repita tema nem ângulo):");
    for (const p of recentes) {
      const rotulo = p.tituloInterno ?? (p.caption ?? "").slice(0, 80) ?? "(sem título)";
      linhas.push(`- ${rotulo}${p.tema ? ` · ${p.tema}` : ""}${p.palavraChave ? ` · CTA "${p.palavraChave}"` : ""}`);
    }
  }

  return linhas.join("\n");
}

// ─── Feedback → aprendizado ──────────────────────────────────────────────────

/**
 * Transforma o motivo de uma reprovação/alteração num aprendizado com tags.
 * As tags são deduzidas do escopo e de palavras do motivo — regra simples e
 * previsível, sem IA no meio.
 */
export function feedbackParaAprendizado(motivo: string, escopo: string): { texto: string; tags: string } | null {
  const limpo = motivo.trim();
  if (limpo.length < 4) return null;

  const tags = new Set<string>();
  const e = escopo.toUpperCase();
  if (e.startsWith("SLIDE") || e === "VISUAL") tags.add("visual");
  if (e === "COPY") tags.add("copy");
  if (e === "LEGENDA") tags.add("legenda");

  const m = limpo.toLowerCase();
  if (/hook|gancho|abertura/.test(m)) tags.add("hook");
  if (/texto|palavr|longo|curto|verbos/.test(m)) tags.add("copy");
  if (/visual|paleta|cor|fonte|layout|design|gener/.test(m)) tags.add("visual");
  if (/cta|comente|chamada/.test(m)) tags.add("cta");
  if (/ia|robô|robotic|artificial/.test(m)) tags.add("tom");
  if (/tema|assunto|repet/.test(m)) tags.add("tema");

  return { texto: limpo, tags: [...tags].join(",") };
}
