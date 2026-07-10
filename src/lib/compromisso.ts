// Lógica de compromissos — funções puras, sem dependências de framework.

/**
 * Diferença em dias entre o prazo e hoje (UTC, sem hora).
 * Positivo = futuro, negativo = passado, 0 = hoje.
 */
export function diasParaVencer(prazoEm: Date | string): number {
  const p = new Date(prazoEm);
  const prazoUTC = Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate());
  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return Math.round((prazoUTC - hojeUTC) / 86_400_000);
}

/**
 * True se o compromisso está vencido (prazo passado e não cumprido).
 */
export function isVencido(prazoEm: Date | string, cumprido: boolean): boolean {
  if (cumprido) return false;
  return diasParaVencer(prazoEm) < 0;
}

/**
 * Label legível para o prazo: "ontem", "hoje", "amanhã", "em X dias", "X dias atrás".
 */
export function fmtPrazo(prazoEm: Date | string): string {
  const dias = diasParaVencer(prazoEm);
  if (dias < -1) return `${Math.abs(dias)} dias atrás`;
  if (dias === -1) return "ontem";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}
