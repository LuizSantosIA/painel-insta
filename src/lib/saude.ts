// Lógica de saúde dos clientes — funções puras, sem dependências de framework.

export type SaudeScore = "VERDE" | "AMARELO" | "VERMELHO";

export type ReceitaParaSaude = {
  status: string;      // PREVISTA | CONFIRMADA | RECEBIDA | INADIMPLENTE
  competencia: Date;   // primeiro dia do mês, UTC
};

export type ClienteParaSaude = {
  status: string;                    // lead | active | inactive | lost
  ultimoContatoEm: Date | null;
  receitas: ReceitaParaSaude[];
};

/**
 * Calcula o score de saúde de um cliente.
 *
 * VERMELHO: inadimplência, ou sem contato há 60+ dias
 * AMARELO:  receita prevista com competência vencida, ou sem contato 30-60 dias,
 *           ou cliente ativo sem receitas
 * VERDE:    tudo em ordem
 */
export function calcSaude(cliente: ClienteParaSaude): SaudeScore {
  const agora = new Date();

  // ── VERMELHO ─────────────────────────────────────────────────────────────
  if (cliente.receitas.some((r) => r.status === "INADIMPLENTE")) {
    return "VERMELHO";
  }

  if (cliente.ultimoContatoEm) {
    const dias = diasDesde(cliente.ultimoContatoEm, agora);
    if (dias > 60) return "VERMELHO";
  }

  // ── AMARELO ──────────────────────────────────────────────────────────────
  const iniciomesAtual = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)
  );
  if (
    cliente.receitas.some(
      (r) => r.status === "PREVISTA" && new Date(r.competencia) < iniciomesAtual
    )
  ) {
    return "AMARELO";
  }

  if (cliente.ultimoContatoEm) {
    const dias = diasDesde(cliente.ultimoContatoEm, agora);
    if (dias > 30) return "AMARELO";
  }

  if (cliente.status === "active" && cliente.receitas.length === 0) {
    return "AMARELO";
  }

  return "VERDE";
}

/** Retorna label legível para o score. */
export function labelSaude(score: SaudeScore): string {
  return { VERDE: "Saudável", AMARELO: "Atenção", VERMELHO: "Em risco" }[score];
}

/** Retorna cor CSS para o score. */
export function corSaude(score: SaudeScore): string {
  return { VERDE: "#22C55E", AMARELO: "#F59E0B", VERMELHO: "#EF4444" }[score];
}

function diasDesde(data: Date, agora: Date): number {
  return (agora.getTime() - new Date(data).getTime()) / 86_400_000;
}
