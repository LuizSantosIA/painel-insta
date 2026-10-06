/**
 * A régua de validade do token do Instagram. Pura — sem banco, sem rede.
 *
 * Tokens de longa duração valem 60 dias. Um token expirado NÃO pode ser
 * renovado: só refazendo a autorização. Por isso a renovação começa aos 30
 * dias de uso e o alerta aparece faltando 7 — a janela de conserto nunca
 * chega a fechar sozinha.
 */

export const DIAS_TOKEN = 60;
/** Idade a partir da qual o cron renova. O Instagram só renova token com mais de 24h. */
export const DIAS_PARA_RENOVAR = 30;
/** Dias restantes a partir dos quais o Hoje cobra uma reconexão. */
export const DIAS_PARA_ALERTAR = 7;

/** Dias inteiros até expirar. Negativo quando já passou; null sem data conhecida. */
export function diasAte(expiraEm: Date | null, agora = new Date()): number | null {
  if (!expiraEm) return null;
  return Math.floor((expiraEm.getTime() - agora.getTime()) / 86_400_000);
}

export function expirado(dias: number | null): boolean {
  return dias !== null && dias <= 0;
}

/** Já passou da idade de renovar? Token vencido não entra: esse só reconectando. */
export function precisaRenovar(dias: number | null): boolean {
  return dias !== null && dias > 0 && dias <= DIAS_TOKEN - DIAS_PARA_RENOVAR;
}

export function precisaAlertar(dias: number | null): boolean {
  return dias !== null && dias <= DIAS_PARA_ALERTAR;
}
