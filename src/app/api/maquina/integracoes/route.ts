import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFollowersCount, isConfigured } from "@/lib/instagram";

/**
 * Estado real das conexões da Máquina.
 *
 * Só aparece aqui o que de fato existe no projeto: a Graph API do Instagram, o
 * token da Página do Facebook (usado como fallback de DM) e o webhook que recebe
 * comentários e mensagens. Nenhuma integração é listada "porque seria bonito ter".
 */

export type EstadoIntegracao = "CONECTADA" | "DESCONECTADA" | "PARCIAL";

export interface Integracao {
  chave: string;
  nome: string;
  descricao: string;
  estado: EstadoIntegracao;
  /** Frase curta do estado, já pronta para a tela. */
  resumo: string;
  ultimaSincronizacao: string | null;
  /** O que está errado ou faltando, quando está. */
  problemas: string[];
  /** Contagens que provam que a conexão está trazendo dados. */
  metricas: { label: string; valor: string }[];
}

export interface IntegracoesResposta {
  integracoes: Integracao[];
  verificadoEm: string;
}

export async function GET() {
  const configurado = await isConfigured();

  const [ultimoPost, totalPosts, ultimoSnapshot, conversas, ultimaConversa, comentarios, ultimoLog] =
    await Promise.all([
      prisma.post.findFirst({
        where: { status: "PUBLICADO" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.post.count({ where: { status: "PUBLICADO" } }),
      prisma.accountSnapshot.findFirst({ orderBy: { date: "desc" } }),
      prisma.igConversation.count(),
      prisma.igConversation.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
      prisma.commentLog.count(),
      prisma.commentLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);

  // Uma chamada real à Graph API — token vencido só aparece quando se tenta usar.
  const seguidores = configurado ? await fetchFollowersCount() : null;
  const tokenValido = seguidores !== null;

  const fbPageId = process.env.FB_PAGE_ID ?? "";
  const fbPageToken = process.env.FB_PAGE_ACCESS_TOKEN ?? "";
  const fbConectada = Boolean(fbPageId && fbPageToken);

  const webhookConfigurado = Boolean(process.env.WEBHOOK_VERIFY_TOKEN && process.env.APP_URL);

  const instagramProblemas: string[] = [];
  if (!configurado) {
    instagramProblemas.push("IG_ACCESS_TOKEN e/ou IG_USER_ID não estão definidos no .env");
  } else if (!tokenValido) {
    instagramProblemas.push(
      "A API não respondeu com os dados da conta — o token pode ter expirado (validade de 60 dias)"
    );
  }

  const integracoes: Integracao[] = [
    {
      chave: "instagram",
      nome: "Instagram · Meta Graph API",
      descricao: "Traz conteúdos, métricas e seguidores. É a base de toda a Máquina.",
      estado: !configurado ? "DESCONECTADA" : tokenValido ? "CONECTADA" : "PARCIAL",
      resumo: !configurado
        ? "Não configurada"
        : tokenValido
          ? "Conectada e respondendo"
          : "Configurada, mas a API não respondeu",
      ultimaSincronizacao: ultimoPost?.updatedAt.toISOString() ?? null,
      problemas: instagramProblemas,
      metricas: [
        { label: "Conteúdos sincronizados", valor: String(totalPosts) },
        {
          label: "Seguidores",
          valor:
            seguidores !== null
              ? seguidores.toLocaleString("pt-BR")
              : ultimoSnapshot
                ? `${ultimoSnapshot.followers.toLocaleString("pt-BR")} (último registro)`
                : "—",
        },
      ],
    },
    {
      chave: "webhook",
      nome: "Webhook de comentários e mensagens",
      descricao: "Recebe cada comentário e direct em tempo real. É o que dispara as automações.",
      estado: comentarios > 0 ? "CONECTADA" : webhookConfigurado ? "PARCIAL" : "DESCONECTADA",
      resumo:
        comentarios > 0
          ? "Recebendo eventos"
          : webhookConfigurado
            ? "Configurado, mas nenhum evento chegou ainda"
            : "Não configurado",
      ultimaSincronizacao: ultimoLog?.createdAt.toISOString() ?? null,
      problemas: webhookConfigurado
        ? []
        : ["Defina WEBHOOK_VERIFY_TOKEN e APP_URL no .env e assine o webhook no painel da Meta"],
      metricas: [{ label: "Eventos processados", valor: comentarios.toLocaleString("pt-BR") }],
    },
    {
      chave: "facebook-page",
      nome: "Página do Facebook · Direct",
      descricao:
        "Token da Página usado como alternativa de envio de DM. Sem ele, o direct depende do comment_id.",
      estado: fbConectada ? "CONECTADA" : "PARCIAL",
      resumo: fbConectada
        ? "Conectada — DM para qualquer pessoa"
        : "Não conectada — DM limitado à resposta de comentário",
      ultimaSincronizacao: ultimaConversa?.syncedAt.toISOString() ?? null,
      problemas: fbConectada
        ? []
        : ["Sem FB_PAGE_ID e FB_PAGE_ACCESS_TOKEN o envio fora do comentário pode falhar"],
      metricas: [{ label: "Conversas no direct", valor: String(conversas) }],
    },
  ];

  const resposta: IntegracoesResposta = {
    integracoes,
    verificadoEm: new Date().toISOString(),
  };

  return NextResponse.json(resposta);
}
