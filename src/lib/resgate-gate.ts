/**
 * Quem pode receber o link atrasado — a régua, pura e sem rede.
 *
 * Em 08/11/2026 descobrimos que `messaging_postbacks` nunca esteve inscrito:
 * 594 pessoas clicaram em "Seguindo" e o clique não chegou ao servidor. Elas
 * ficaram esperando um material que nunca veio. Este módulo decide quem dá
 * para alcançar agora sem passar por cima da política da Meta.
 *
 * A trava que manda é a janela de 24 horas: fora dela, a Meta não permite que
 * o negócio escreva primeiro. Usamos 23h de propósito — uma margem, para o
 * tempo entre decidir e enviar não estourar o limite.
 */

/** Janela da Meta para resposta, menos uma hora de folga. */
export const JANELA_RESPOSTA_MS = 23 * 60 * 60 * 1000;

export type MotivoPulo = "FORA_DA_JANELA" | "NAO_SEGUE" | "SEGUE_DESCONHECIDO" | "JA_ENTREGUE";

export const LABEL_PULO: Record<MotivoPulo, string> = {
  FORA_DA_JANELA: "passou das 24h — a Meta não deixa escrever primeiro",
  NAO_SEGUE: "não segue a conta",
  SEGUE_DESCONHECIDO: "a Meta não informou se segue",
  JA_ENTREGUE: "já recebeu",
};

export interface GateParaResgate {
  id: string;
  igsid: string;
  username: string;
  status: string;
  /** A interação mais recente dessa pessoa, de onde a janela é contada. */
  ultimaInteracaoEm: Date;
}

export function dentroDaJanela(ultimaInteracaoEm: Date, agora = new Date()): boolean {
  return agora.getTime() - ultimaInteracaoEm.getTime() < JANELA_RESPOSTA_MS;
}

/** Horas que ainda restam da janela. Negativo quando já passou. */
export function horasRestantes(ultimaInteracaoEm: Date, agora = new Date()): number {
  const ms = JANELA_RESPOSTA_MS - (agora.getTime() - ultimaInteracaoEm.getTime());
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export type DecisaoResgate = { resgatar: true } | { resgatar: false; motivo: MotivoPulo };

/**
 * `segue` vem de is_user_follow_business e pode ser null quando a Meta recusa
 * a consulta. Null não entrega: o material é a contrapartida do follow, e
 * entregar sem confirmar esvazia a trava.
 */
export function decidirResgate(
  gate: GateParaResgate,
  segue: boolean | null,
  agora = new Date()
): DecisaoResgate {
  if (gate.status === "DELIVERED") return { resgatar: false, motivo: "JA_ENTREGUE" };
  if (!dentroDaJanela(gate.ultimaInteracaoEm, agora)) return { resgatar: false, motivo: "FORA_DA_JANELA" };
  if (segue === null) return { resgatar: false, motivo: "SEGUE_DESCONHECIDO" };
  if (!segue) return { resgatar: false, motivo: "NAO_SEGUE" };
  return { resgatar: true };
}

/**
 * Separa quem vale a pena consultar: a janela é filtro de graça, a consulta de
 * follow é uma chamada de API por pessoa. Filtrar antes evita centenas de
 * chamadas que já se sabe que não levam a nada.
 */
export function candidatosNaJanela<T extends GateParaResgate>(gates: T[], agora = new Date()): T[] {
  return gates
    .filter((g) => g.status !== "DELIVERED" && dentroDaJanela(g.ultimaInteracaoEm, agora))
    .sort((a, b) => b.ultimaInteracaoEm.getTime() - a.ultimaInteracaoEm.getTime());
}
