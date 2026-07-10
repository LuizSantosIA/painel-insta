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
