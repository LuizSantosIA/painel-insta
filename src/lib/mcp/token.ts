import { timingSafeEqual } from "node:crypto";

/**
 * Autenticação da superfície MCP.
 *
 * Todo o resto do Command Center é protegido pelo login da Vercel. O /api/mcp
 * precisa ser falado por um programa, então ganha o seu próprio token — e sem
 * MCP_API_TOKEN configurado a superfície fica fechada, nunca aberta.
 */

export type Veredito = { ok: true } | { ok: false; status: 401 | 503; erro: string };

export function tokenConfigurado(): boolean {
  return (process.env.MCP_API_TOKEN ?? "").trim().length >= 24;
}

/** Comparação em tempo constante — tamanhos diferentes já reprovam. */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Aceita `Authorization: Bearer <token>` ou `x-mcp-token: <token>`. */
export function extrairToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const direto = headers.get("x-mcp-token");
  return direto?.trim() || null;
}

export function autorizar(headers: Headers): Veredito {
  const esperado = (process.env.MCP_API_TOKEN ?? "").trim();
  if (esperado.length < 24) {
    return { ok: false, status: 503, erro: "MCP desligado: configure MCP_API_TOKEN (mínimo 24 caracteres)." };
  }
  const recebido = extrairToken(headers);
  if (!recebido || !iguais(recebido, esperado)) {
    return { ok: false, status: 401, erro: "Token inválido." };
  }
  return { ok: true };
}
