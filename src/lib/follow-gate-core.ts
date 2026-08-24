// Lógica da trava de seguidor — funções puras, sem dependências de framework.
//
// A parte que fala com a Meta e com o banco fica em follow-gate.ts.

export const GATE_PAYLOAD_PREFIX = "FOLLOWGATE:";

/** Depois disso paramos de repetir o pedido, para não virar spam nem queimar rate limit. */
export const MAX_TENTATIVAS = 8;

export const ASK_PADRAO =
  "Para conseguir te liberar o link, preciso que me siga (e depois clique em seguindo para validar)! Assim já te envio";
export const DELIVER_PADRAO = "Clique para Acessar o material (Gratuito)";
export const DESISTIR_PADRAO =
  "Não consegui confirmar seu follow por aqui. Me chama no direct que eu te mando o link na mão 🙂";

/** Só os campos da AutoRule que a trava usa — o model do Prisma satisfaz este formato. */
export interface RegraGate {
  id: string;
  exigirSeguir: boolean;
  linkLiberado: string;
  gateAskText: string;
  gateButtonLabel: string;
  gateDeliverText: string;
  gateLinkLabel: string;
}

export function textoPedido(rule: RegraGate): string {
  return rule.gateAskText.trim() || ASK_PADRAO;
}

export function textoEntrega(rule: RegraGate): string {
  return rule.gateDeliverText.trim() || DELIVER_PADRAO;
}

export function rotuloBotao(rule: RegraGate): string {
  return rule.gateButtonLabel.trim() || "Seguindo";
}

export function rotuloLink(rule: RegraGate): string {
  return rule.gateLinkLabel.trim() || "Acessar";
}

export function payloadDaRegra(ruleId: string): string {
  return `${GATE_PAYLOAD_PREFIX}${ruleId}`;
}

export function ruleIdDoPayload(payload: string): string | null {
  if (!payload.startsWith(GATE_PAYLOAD_PREFIX)) return null;
  return payload.slice(GATE_PAYLOAD_PREFIX.length) || null;
}

/** A regra está pronta para usar a trava? Sem link válido não há o que entregar. */
export function gateConfigurado(rule: RegraGate): boolean {
  return rule.exigirSeguir && /^https?:\/\//i.test(rule.linkLiberado.trim());
}

/** Normaliza para comparar texto digitado com o rótulo do botão (fallback sem quick reply). */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export type AcaoGate = "ENTREGAR" | "REPETIR" | "DESISTIR";

/**
 * O que fazer quando a pessoa clica no botão de validação.
 *
 * `segue === null` é o caso comum de erro da User Profile API (falta de consentimento,
 * bloqueio) — tratamos como "ainda não sei", ou seja, pedimos de novo em vez de entregar.
 */
export function decidirAcaoGate(segue: boolean | null, tentativas: number): AcaoGate {
  if (segue === true) return "ENTREGAR";
  if (tentativas >= MAX_TENTATIVAS) return "DESISTIR";
  return "REPETIR";
}
