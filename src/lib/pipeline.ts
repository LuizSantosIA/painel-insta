// Lógica de negócio do Pipeline — funções puras, sem dependências de framework.

export const ESTAGIOS_PIPELINE = [
  "LEAD",
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "FECHADO",
  "PERDIDO",
] as const;

export type EstagioLead = (typeof ESTAGIOS_PIPELINE)[number];

/** Rótulos legíveis dos estágios — usados no pipeline e nos resumos. */
export const ESTAGIO_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUALIFICADO: "Qualificado",
  PROPOSTA_ENVIADA: "Proposta",
  NEGOCIACAO: "Negociação",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

export function labelEstagio(estagio: string): string {
  return ESTAGIO_LABELS[estagio] ?? estagio;
}

export const ESTAGIOS_ATIVOS: string[] = [
  "LEAD",
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
];

/**
 * Valida a regra inegociável: leads em estágios ativos precisam de próxima ação.
 * Retorna mensagem de erro ou null se válido.
 */
export function validarLeadAtivo(data: {
  estagio: string;
  proximaAcao: string | null | undefined;
  proximaAcaoEm: Date | string | null | undefined;
}): string | null {
  if (!ESTAGIOS_ATIVOS.includes(data.estagio)) return null;
  if (!data.proximaAcao?.trim()) {
    return "Próxima ação é obrigatória para leads ativos";
  }
  if (!data.proximaAcaoEm) {
    return "Data da próxima ação é obrigatória para leads ativos";
  }
  return null;
}

/**
 * True se a próxima ação está com data vencida (anteriores a hoje, UTC).
 */
export function isAtrasado(
  proximaAcaoEm: Date | string | null | undefined,
): boolean {
  if (!proximaAcaoEm) return false;
  const d = new Date(proximaAcaoEm);
  const hoje = new Date();
  const dStr = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  const hStr = `${hoje.getUTCFullYear()}-${hoje.getUTCMonth()}-${hoje.getUTCDate()}`;
  return dStr < hStr;
}

// ─── Tempo parado no estágio ─────────────────────────────────────────────────

/**
 * Limiares de estagnação, em dias no mesmo estágio.
 *
 * Ficam aqui, e não espalhados no frontend, porque a mesma régua vale para o
 * card do pipeline e para os alertas do dashboard. Ajuste em um lugar só.
 */
export const DIAS_PARADO_ATENCAO = 7;
export const DIAS_PARADO_RISCO = 14;

export type TomParado = "NEUTRO" | "ATENCAO" | "RISCO";

export function tomTempoParado(dias: number | null): TomParado {
  if (dias === null) return "NEUTRO";
  if (dias >= DIAS_PARADO_RISCO) return "RISCO";
  if (dias >= DIAS_PARADO_ATENCAO) return "ATENCAO";
  return "NEUTRO";
}

/**
 * Dias no estágio atual. Devolve null quando a oportunidade é anterior ao campo
 * `estagioDesde` — nesse caso a tela mostra "—" em vez de fingir uma data.
 */
export function diasNoEstagio(
  estagioDesde: Date | string | null | undefined,
  agora = new Date()
): number | null {
  if (!estagioDesde) return null;
  const desde = new Date(estagioDesde);
  const inicio = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  return Math.max(0, Math.round((hoje - inicio) / 86_400_000));
}

/** Rótulo curto do tempo no estágio: "Hoje", "1 dia", "6 dias", "—". */
export function fmtTempoNoEstagio(dias: number | null): string {
  if (dias === null) return "—";
  if (dias === 0) return "Hoje";
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

// ─── Motivos de perda ────────────────────────────────────────────────────────

export const MOTIVOS_PERDA = [
  { key: "PRECO", label: "Preço" },
  { key: "SEM_RESPOSTA", label: "Sem resposta" },
  { key: "TIMING", label: "Timing" },
  { key: "CONCORRENTE", label: "Concorrente" },
  { key: "NAO_FIT", label: "Não era fit" },
  { key: "DESISTIU", label: "Desistiu" },
  { key: "OUTRO", label: "Outro" },
] as const;

export function labelMotivoPerda(motivo: string | null): string | null {
  if (!motivo) return null;
  return MOTIVOS_PERDA.find((m) => m.key === motivo)?.label ?? motivo;
}

// ─── Resumo comercial ────────────────────────────────────────────────────────

export interface LeadResumo {
  estagio: string;
  valorEstimadoCentavos: number | null;
}

export interface ResumoPipeline {
  totalCentavos: number;
  quantidade: number;
  ticketMedioCentavos: number | null;
  /**
   * Valor ponderado pela chance de fechar. Fica null enquanto não existir
   * probabilidade por oportunidade — arbitrar um percentual por estágio daria
   * um número bonito e sem significado.
   */
  ponderadoCentavos: number | null;
}

export function calcResumoPipeline(leads: LeadResumo[]): ResumoPipeline {
  const ativos = leads.filter((l) => ESTAGIOS_ATIVOS.includes(l.estagio));
  const totalCentavos = ativos.reduce((s, l) => s + (l.valorEstimadoCentavos ?? 0), 0);

  // O ticket médio considera só quem tem valor estimado; senão a média mente para baixo.
  const comValor = ativos.filter((l) => (l.valorEstimadoCentavos ?? 0) > 0);

  return {
    totalCentavos,
    quantidade: ativos.length,
    ticketMedioCentavos: comValor.length
      ? Math.round(totalCentavos / comValor.length)
      : null,
    ponderadoCentavos: null,
  };
}
