// Etapas da máquina de conteúdo — funções puras, sem dependências de framework.
//
// `etapa` é a granularidade fina do pipeline de agentes. `status` (o que Conteúdo
// e Calendário leem) é DERIVADO dela, para as telas existentes não mudarem.

export const ETAPAS = [
  "RADAR",
  "IDEIA",
  "SELECIONADA",
  "COPY",
  "DESIGN",
  "REVISAO",
  "AGUARDANDO_APROVACAO",
  "AGENDADO",
  "PUBLICADO",
  "ANALISE",
  "REPROVADO",
] as const;

export type Etapa = (typeof ETAPAS)[number];

export const LABEL_ETAPA: Record<Etapa, string> = {
  RADAR: "Radar",
  IDEIA: "Ideia",
  SELECIONADA: "Selecionada",
  COPY: "Copy",
  DESIGN: "Design",
  REVISAO: "Revisão",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
  ANALISE: "Análise",
  REPROVADO: "Reprovado",
};

/** As colunas do pipeline visual, na ordem. REPROVADO fica fora — é resultado, não fila. */
export const ETAPAS_PIPELINE: Etapa[] = [
  "IDEIA",
  "SELECIONADA",
  "COPY",
  "DESIGN",
  "REVISAO",
  "AGUARDANDO_APROVACAO",
  "AGENDADO",
  "PUBLICADO",
  "ANALISE",
];

/** Etapas em que a máquina ainda está trabalhando (nada para você decidir). */
export const ETAPAS_EM_PRODUCAO: Etapa[] = ["SELECIONADA", "COPY", "DESIGN", "REVISAO"];

export function isEtapa(v: string | null | undefined): v is Etapa {
  return (ETAPAS as readonly string[]).includes(v ?? "");
}

/**
 * O status que Conteúdo e Calendário entendem, a partir da etapa da máquina.
 * IDEIA e RASCUNHO cobrem toda a produção; AGENDADO/PUBLICADO são literais.
 */
export function statusDaEtapa(etapa: Etapa): "IDEIA" | "RASCUNHO" | "AGENDADO" | "PUBLICADO" {
  switch (etapa) {
    case "RADAR":
    case "IDEIA":
      return "IDEIA";
    case "AGENDADO":
      return "AGENDADO";
    case "PUBLICADO":
    case "ANALISE":
      return "PUBLICADO";
    default:
      return "RASCUNHO";
  }
}

/**
 * Quais agentes rodam, em ordem, quando o post está numa etapa de produção.
 * Ao terminarem, o post avança para proximaEtapa(). Quem decide o caminho é
 * esta tabela, nunca o prompt de um agente.
 *
 *   SELECIONADA → (Viral Adapter, se for adaptação) → Copywriter      → COPY
 *   COPY        → Diretor Visual → Gerador (um por slide)             → DESIGN
 *   DESIGN      → Fact Checker                                        → REVISAO
 *   REVISAO     → Lead Magnet → Revisor Final                         → AGUARDANDO_APROVACAO
 */
export const AGENTES_DA_ETAPA: Partial<Record<Etapa, Agente[]>> = {
  SELECIONADA: ["VIRAL_ADAPTER", "COPYWRITER"],
  COPY: ["DIRETOR_VISUAL", "GERADOR"],
  DESIGN: ["FACT_CHECKER"],
  REVISAO: ["LEAD_MAGNET", "REVISOR"],
};

export const AGENTES = [
  "RADAR",
  "ESTRATEGISTA",
  "VIRAL_ADAPTER",
  "COPYWRITER",
  "DIRETOR_VISUAL",
  "GERADOR",
  "FACT_CHECKER",
  "LEAD_MAGNET",
  "REVISOR",
  "PUBLICADOR",
  "PERFORMANCE",
] as const;

export type Agente = (typeof AGENTES)[number];

export const LABEL_AGENTE: Record<Agente, string> = {
  RADAR: "Radar",
  ESTRATEGISTA: "Estrategista",
  VIRAL_ADAPTER: "Viral Adapter",
  COPYWRITER: "Copywriter",
  DIRETOR_VISUAL: "Diretor Visual",
  GERADOR: "Gerador Visual",
  FACT_CHECKER: "Fact Checker",
  LEAD_MAGNET: "Lead Magnet",
  REVISOR: "Revisor Final",
  PUBLICADOR: "Publicador",
  PERFORMANCE: "Performance",
};

/**
 * Etapa seguinte depois de um agente terminar com sucesso.
 * As transições são fechadas aqui: nenhum agente escolhe para onde o post vai.
 */
export function proximaEtapa(atual: Etapa): Etapa | null {
  switch (atual) {
    case "SELECIONADA":
      return "COPY";
    case "COPY":
      return "DESIGN";
    case "DESIGN":
      return "REVISAO";
    case "REVISAO":
      return "AGUARDANDO_APROVACAO";
    case "AGENDADO":
      return "PUBLICADO";
    case "PUBLICADO":
      return "ANALISE";
    default:
      return null;
  }
}

// ─── Modos de automação ──────────────────────────────────────────────────────

export const MODOS = ["MANUAL", "COPILOTO", "AUTOPILOT"] as const;
export type Modo = (typeof MODOS)[number];

export function isModo(v: string | null | undefined): v is Modo {
  return (MODOS as readonly string[]).includes(v ?? "");
}

/** Só AUTOPILOT deixa a máquina publicar sem clique seu. Decidido em código, não em prompt. */
export function podePublicarSozinha(modo: Modo): boolean {
  return modo === "AUTOPILOT";
}

/** Em MANUAL a máquina não avança sozinha: cada etapa espera um clique. */
export function avancaSozinha(modo: Modo): boolean {
  return modo !== "MANUAL";
}

// ─── Decisão sua ─────────────────────────────────────────────────────────────

export const DECISOES = ["APROVADO", "REPROVADO", "ALTERACAO"] as const;
export type Decisao = (typeof DECISOES)[number];

export type Escopo =
  | { tipo: "POST" }
  | { tipo: "COPY" }
  | { tipo: "LEGENDA" }
  | { tipo: "VISUAL" }
  | { tipo: "SLIDE"; ordem: number };

/** "SLIDE:3" ⇄ { tipo: "SLIDE", ordem: 3 } — o formato gravado no banco. */
export function escopoParaTexto(e: Escopo): string {
  return e.tipo === "SLIDE" ? `SLIDE:${e.ordem}` : e.tipo;
}

export function textoParaEscopo(s: string): Escopo {
  const m = /^SLIDE:(\d+)$/.exec(s);
  if (m) return { tipo: "SLIDE", ordem: Number(m[1]) };
  if (s === "COPY" || s === "LEGENDA" || s === "VISUAL") return { tipo: s };
  return { tipo: "POST" };
}

/**
 * Para onde o post volta quando você pede alteração — o mínimo necessário.
 *
 *   SLIDE:n  → refaz só aquele slide (design), sem tocar no resto
 *   VISUAL   → refaz o design de todos os slides, copy intacta
 *   COPY     → volta para a copy; o design é refeito depois
 *   LEGENDA  → só a legenda; nem passa pelo design
 *   POST     → recomeça da seleção
 */
export function etapaAposAlteracao(escopo: Escopo): Etapa {
  switch (escopo.tipo) {
    case "SLIDE":
    case "VISUAL":
      return "COPY"; // a etapa COPY é onde o Diretor Visual roda (ver AGENTE_DA_ETAPA)
    case "COPY":
      return "SELECIONADA";
    case "LEGENDA":
      return "REVISAO";
    case "POST":
      return "SELECIONADA";
  }
}

// ─── Objetivos e tipos ───────────────────────────────────────────────────────

export const OBJETIVOS = ["ALCANCE", "AUTORIDADE", "CONVERSAO"] as const;
export type Objetivo = (typeof OBJETIVOS)[number];

export const LABEL_OBJETIVO: Record<Objetivo, string> = {
  ALCANCE: "Alcance",
  AUTORIDADE: "Autoridade",
  CONVERSAO: "Conversão",
};

export const TIPOS_CONTEUDO = ["VIRAL_ADAPTADO", "ORIGINAL", "AUTORIDADE", "EMPRESA"] as const;
export type TipoConteudo = (typeof TIPOS_CONTEUDO)[number];

export const LABEL_TIPO: Record<TipoConteudo, string> = {
  VIRAL_ADAPTADO: "Viral adaptado",
  ORIGINAL: "Original",
  AUTORIDADE: "Autoridade",
  EMPRESA: "Empresa",
};

/**
 * Ordem dos posts do dia: alcance primeiro, depois autoridade, depois conversão —
 * a sequência que você definiu para 1, 2 e 3 posts.
 */
export const ORDEM_OBJETIVO: Objetivo[] = ["ALCANCE", "AUTORIDADE", "CONVERSAO"];

/** Máximo de posts que a máquina produz por dia. Qualidade manda: pode ser menos. */
export const POSTS_POR_DIA = 3;
