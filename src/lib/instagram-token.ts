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

/**
 * Quem é "a própria conta", para o webhook não responder a si mesma.
 *
 * A mesma conta aparece com DOIS ids diferentes: o do Instagram Login, que as
 * chamadas usam, e o IG User ID clássico, que é o que vem no webhook. Os dois
 * contam — e o @ entra como terceira trava, caso a Meta mude os ids de novo.
 *
 * Em 22/10/2026 a falta disso virou um laço: a resposta automática continha a
 * palavra-chave da própria regra, e a automação respondeu a si mesma 13 vezes.
 */
export interface IdentidadeConta {
  ids: Set<string>;
  username: string;
}

function limparId(v?: string | null): string {
  return (v ?? "").replace(/^\ufeff/, "").trim();
}

export function montarIdentidade(dados: {
  ids: (string | null | undefined)[];
  username?: string | null;
}): IdentidadeConta {
  return {
    ids: new Set(dados.ids.map(limparId).filter(Boolean)),
    username: (dados.username ?? "").replace(/^@/, "").trim().toLowerCase(),
  };
}

/** O comentário (ou mensagem) foi escrito pela própria conta? */
export function ehDaPropriaConta(
  identidade: IdentidadeConta,
  autor: { id?: string | null; username?: string | null }
): boolean {
  const id = limparId(autor.id);
  if (id && identidade.ids.has(id)) return true;

  const user = (autor.username ?? "").replace(/^@/, "").trim().toLowerCase();
  return Boolean(user && identidade.username && user === identidade.username);
}

/**
 * Campos de webhook que a conta precisa ter inscritos.
 *
 * `messaging_postbacks` é o que entrega o toque num botão. Sem ele a conta
 * recebe comentários e mensagens normalmente, mas o clique em "Seguindo"
 * simplesmente não chega — e a pessoa fica esperando um link que nunca vem.
 * Foi o que aconteceu até 08/11/2026: só `comments,messages` estavam
 * inscritos, e 594 pessoas pediram material sem nunca receber.
 */
export const CAMPOS_WEBHOOK = "comments,messages,messaging_postbacks";

export const CAMPOS_WEBHOOK_LISTA = CAMPOS_WEBHOOK.split(",");

/** Quais campos obrigatórios estão faltando na inscrição atual. */
export function camposFaltando(inscritos: string[]): string[] {
  const tem = new Set(inscritos);
  return CAMPOS_WEBHOOK_LISTA.filter((c) => !tem.has(c));
}
