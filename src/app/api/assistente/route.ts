import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
} from "ai";
import { FERRAMENTAS } from "@/lib/mcp/ferramentas";

/**
 * O assistente do painel.
 *
 * Mesmas ferramentas que o MCP serve ao Jarvis e ao Claude Desktop — nenhuma
 * lógica nova. Três bocas, um cérebro só: o que o assistente responde aqui é
 * exatamente o que a tela mostra e o que o agente externo leria.
 *
 * Fase 1 é toda de leitura. Nada aqui publica, cobra ou manda mensagem.
 */

export const maxDuration = 120;

const MODELO = process.env.ASSISTENTE_MODELO ?? "anthropic/claude-sonnet-5";

const SISTEMA = `Você é o assistente do Command Center do Luiz — o painel que ele usa para tocar o negócio: Instagram, clientes, dinheiro, pipeline comercial e a máquina de conteúdo.

Como responder:
- Português do Brasil, direto, sem rodeio e sem repetir a pergunta.
- Consulte as ferramentas antes de responder qualquer coisa sobre o negócio. Nunca estime, nunca invente número.
- Para pergunta aberta sobre o dia ("como está?", "o que eu faço agora?"), comece pela ferramenta hoje.
- Cruze ferramentas quando a pergunta pedir: "vale a pena cobrar?" olha financeiro e clientes.
- Dê o número e o que fazer com ele. Uma recomendação clara vale mais que uma lista de tudo.
- Quando houver um id (post, cliente, lead), cite o nome, não o id, a não ser que ele peça.
- Se a ferramenta devolver vazio, diga que está vazio. Não preencha o silêncio.
- Você só lê. Se ele pedir para aprovar, publicar, cobrar ou mandar mensagem, diga em que tela isso se faz e que a ação por aqui ainda não existe.`;

/** As mesmas FERRAMENTAS do MCP, no formato que o modelo entende. */
function ferramentas(): ToolSet {
  return Object.fromEntries(
    FERRAMENTAS.map((f) => [
      f.nome,
      tool({
        description: f.descricao,
        inputSchema: f.schema,
        execute: async (args) => f.executar(args as Record<string, unknown>),
      }),
    ])
  );
}

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "Falta AI_GATEWAY_API_KEY. Configure na Vercel para o assistente responder." },
      { status: 503 }
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: MODELO,
    system: SISTEMA,
    messages: await convertToModelMessages(messages),
    tools: ferramentas(),
    // Deixa o modelo consultar, ler o resultado e consultar de novo antes de responder.
    stopWhen: isStepCount(8),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (e) => (e instanceof Error ? e.message : "Falhou ao consultar o painel."),
    }),
  });
}
