#!/usr/bin/env node
/**
 * Servidor MCP do Command Center — roda na SUA máquina, por stdio.
 *
 * O agente (OpenJarvis, Claude Desktop, Claude Code) fala com este processo;
 * ele fala com o Command Center na Vercel por HTTPS, com o token guardado aqui.
 * Nada novo fica exposto na internet: a única porta pública é a /api/mcp, que
 * só responde a quem tem o token.
 *
 * As ferramentas são descobertas no boot a partir do servidor, então uma
 * ferramenta nova no Command Center aparece aqui sem atualizar este arquivo.
 *
 * Variáveis:
 *   COMMAND_CENTER_URL     https://seu-painel.vercel.app   (obrigatória)
 *   COMMAND_CENTER_TOKEN   o mesmo valor de MCP_API_TOKEN  (obrigatória)
 *   VERCEL_BYPASS_TOKEN    segredo do Protection Bypass for Automation (opcional,
 *                          necessário se o projeto tiver proteção de deploy ligada)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.COMMAND_CENTER_URL ?? "").replace(/\/+$/, "");
const TOKEN = process.env.COMMAND_CENTER_TOKEN ?? "";
const BYPASS = process.env.VERCEL_BYPASS_TOKEN ?? "";

if (!BASE || !TOKEN) {
  console.error("Faltam COMMAND_CENTER_URL e/ou COMMAND_CENTER_TOKEN. Veja mcp/README.md.");
  process.exit(1);
}

function cabecalhos() {
  const h = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
  if (BYPASS) h["x-vercel-protection-bypass"] = BYPASS;
  return h;
}

async function pedir(caminho, init = {}) {
  const r = await fetch(`${BASE}${caminho}`, { ...init, headers: cabecalhos() });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.error ?? `HTTP ${r.status}`);
  return corpo;
}

/** Contrato pobre do catálogo → ZodRawShape, que é o que o SDK aceita. */
function entrada(parametros) {
  if (!parametros?.length) return undefined;
  const forma = {};
  for (const p of parametros) {
    let campo =
      p.tipo === "booleano"
        ? z.boolean()
        : p.tipo === "numero"
          ? z.number()
          : p.tipo === "opcao"
            ? z.enum(p.opcoes)
            : z.string();
    if (p.descricao) campo = campo.describe(p.descricao);
    if (p.padrao !== undefined) campo = campo.default(p.padrao);
    else if (!p.obrigatorio) campo = campo.optional();
    forma[p.nome] = campo;
  }
  return forma;
}

const server = new McpServer(
  { name: "command-center", version: "1.0.0" },
  {
    instructions:
      "Command Center do Luiz: Instagram, clientes, dinheiro, pipeline e a máquina de conteúdo. " +
      "Para perguntas abertas sobre o dia, chame 'hoje' primeiro. Todas as ferramentas são de leitura — " +
      "nada aqui publica, cobra ou envia mensagem. Responda em português, direto, usando os números que vierem.",
  }
);

const { ferramentas } = await pedir("/api/mcp");

for (const f of ferramentas) {
  server.registerTool(
    f.nome,
    {
      title: f.titulo,
      description: f.descricao,
      inputSchema: entrada(f.parametros),
      annotations: { readOnlyHint: f.somenteLeitura, openWorldHint: true },
    },
    async (args) => {
      try {
        const { texto } = await pedir("/api/mcp", {
          method: "POST",
          body: JSON.stringify({ tool: f.nome, args: args ?? {} }),
        });
        return { content: [{ type: "text", text: texto }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Falhou: ${e.message}` }], isError: true };
      }
    }
  );
}

await server.connect(new StdioServerTransport());
console.error(`[command-center] ${ferramentas.length} ferramentas prontas · ${BASE}`);
