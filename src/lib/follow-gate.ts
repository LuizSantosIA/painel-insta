import "server-only";
import { prisma } from "@/lib/prisma";
import type { AutoRule } from "@/generated/prisma/client";
import {
  isFollower,
  sendPostbackButtons,
  sendPostbackButtonsToCommenter,
  sendUrlButtons,
  sendDmToCommenter,
  sendDirectMessage,
} from "@/lib/instagram";
import {
  DESISTIR_PADRAO,
  decidirAcaoGate,
  gateConfigurado,
  payloadDaRegra,
  rotuloBotao,
  rotuloLink,
  textoEntrega,
  textoPedido,
} from "@/lib/follow-gate-core";

/**
 * Trava de seguidor ("siga para liberar o link") — a parte com I/O.
 * As decisões puras ficam em follow-gate-core.ts.
 *
 * Fluxo:
 *   1. A regra dispara (comentário ou DM) → mandamos o pedido de follow como um
 *      template de botão, que fica dentro do balão até ser tocado.
 *   2. A pessoa toca → o toque chega no webhook como messaging_postbacks.
 *   3. Consultamos is_user_follow_business e decidimos entregar, repetir ou desistir.
 */

export { gateConfigurado, normalizar, ruleIdDoPayload } from "@/lib/follow-gate-core";

/**
 * O pedido de follow usa template de botão, não quick reply.
 *
 * Quick reply vira chip na barra de digitação e some quando a pessoa sai da
 * conversa — o botão precisa continuar no balão até ser tocado, do mesmo jeito
 * que o botão do link. O toque chega no webhook como messaging_postbacks.
 */
async function pedirFollow(rule: AutoRule, igsid: string): Promise<void> {
  await sendPostbackButtons(igsid, textoPedido(rule), [
    { title: rotuloBotao(rule), payload: payloadDaRegra(rule.id) },
  ]);
}

async function entregarLink(rule: AutoRule, igsid: string): Promise<void> {
  await sendUrlButtons(igsid, textoEntrega(rule), [
    { title: rotuloLink(rule), url: rule.linkLiberado.trim() },
  ]);
}

export type ResultadoGate =
  | "ENTREGUE"
  | "PEDIDO_ENVIADO"
  | "LIMITE_ATINGIDO"
  | "REGRA_INVALIDA"
  | "ERRO";

/**
 * Abre a trava a partir de um DM / resposta de story, onde já temos o IGSID.
 * Se a pessoa já segue, entrega o link direto — sem obrigar o clique no botão.
 */
export async function iniciarGatePorDm(
  rule: AutoRule,
  igsid: string,
  username = "",
  postId: string | null = null
): Promise<ResultadoGate> {
  if (!gateConfigurado(rule)) return "REGRA_INVALIDA";

  const segue = await isFollower(igsid);

  try {
    if (segue === true) {
      await entregarLink(rule, igsid);
      await registrarGate(rule.id, igsid, { username, origem: "DM", postId, entregue: true });
      return "ENTREGUE";
    }

    await pedirFollow(rule, igsid);
  } catch (e) {
    console.error("[gate] falha ao abrir a trava por DM:", (e as Error).message);
    return "ERRO";
  }

  await registrarGate(rule.id, igsid, { username, origem: "DM", postId, entregue: false });
  return "PEDIDO_ENVIADO";
}

/**
 * Abre a trava a partir de um comentário, usando private reply (recipient.comment_id).
 * A doc da Meta não garante template de botão em private reply, então se falhar
 * mandamos texto puro pedindo para a pessoa responder com o rótulo do botão — o
 * handler de DM reconhece essa resposta e continua o fluxo do mesmo jeito.
 */
export async function iniciarGatePorComentario(
  rule: AutoRule,
  commentId: string,
  igsid: string,
  username = "",
  postId: string | null = null
): Promise<ResultadoGate> {
  if (!gateConfigurado(rule)) return "REGRA_INVALIDA";

  const rotulo = rotuloBotao(rule);

  try {
    await sendPostbackButtonsToCommenter(commentId, textoPedido(rule), [
      { title: rotulo, payload: payloadDaRegra(rule.id) },
    ]);
  } catch (e) {
    console.warn("[gate] botão por comment_id falhou, caindo para texto:", (e as Error).message);
    try {
      await sendDmToCommenter(commentId, `${textoPedido(rule)}\n\nDepois responda "${rotulo}" aqui.`);
    } catch (e2) {
      console.error("[gate] fallback em texto também falhou:", (e2 as Error).message);
      return "ERRO";
    }
  }

  if (igsid) {
    await registrarGate(rule.id, igsid, { username, origem: "COMENTARIO", postId, entregue: false });
  }
  return "PEDIDO_ENVIADO";
}

/**
 * A pessoa clicou no botão (ou digitou o rótulo). Confere o follow e decide o que enviar.
 */
export async function resolverCliqueGate(
  ruleId: string,
  igsid: string,
  username = ""
): Promise<ResultadoGate> {
  const rule = await prisma.autoRule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.isActive || !gateConfigurado(rule)) return "REGRA_INVALIDA";

  const gate = await registrarGate(rule.id, igsid, {
    username,
    origem: "DM",
    postId: null,
    entregue: false,
    incrementarTentativa: true,
  });

  const segue = await isFollower(igsid);

  switch (decidirAcaoGate(segue, gate.attempts)) {
    case "ENTREGAR":
      try {
        await entregarLink(rule, igsid);
      } catch (e) {
        console.error("[gate] falha ao entregar o link:", (e as Error).message);
        return "ERRO";
      }
      await prisma.followGate.update({
        where: { id: gate.id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      return "ENTREGUE";

    case "DESISTIR":
      try {
        await sendDirectMessage(igsid, DESISTIR_PADRAO);
      } catch {
        /* já estamos desistindo mesmo */
      }
      return "LIMITE_ATINGIDO";

    case "REPETIR":
      try {
        await pedirFollow(rule, igsid);
      } catch (e) {
        console.error("[gate] falha ao repetir o pedido:", (e as Error).message);
        return "ERRO";
      }
      return "PEDIDO_ENVIADO";
  }
}

/** Existe uma trava aberta para esta pessoa? Usado no fallback em texto puro. */
export async function gatePendente(igsid: string) {
  return prisma.followGate.findFirst({
    where: { igsid, status: "PENDING" },
    orderBy: { updatedAt: "desc" },
    include: { rule: true },
  });
}

async function registrarGate(
  ruleId: string,
  igsid: string,
  opts: {
    username: string;
    origem: string;
    postId: string | null;
    entregue: boolean;
    incrementarTentativa?: boolean;
  }
) {
  const agora = new Date();
  return prisma.followGate.upsert({
    where: { igsid_ruleId: { igsid, ruleId } },
    create: {
      igsid,
      ruleId,
      username: opts.username,
      origem: opts.origem,
      postId: opts.postId,
      attempts: opts.incrementarTentativa ? 1 : 0,
      status: opts.entregue ? "DELIVERED" : "PENDING",
      deliveredAt: opts.entregue ? agora : null,
      updatedAt: agora,
    },
    update: {
      ...(opts.username && { username: opts.username }),
      ...(opts.postId && { postId: opts.postId }),
      ...(opts.incrementarTentativa && { attempts: { increment: 1 } }),
      ...(opts.entregue && { status: "DELIVERED", deliveredAt: agora }),
      updatedAt: agora,
    },
  });
}
