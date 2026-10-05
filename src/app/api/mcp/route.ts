import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autorizar } from "@/lib/mcp/token";
import { acharFerramenta, catalogo } from "@/lib/mcp/ferramentas";

/**
 * Superfície MCP do Command Center.
 *
 * GET  → catálogo das ferramentas (nome, descrição, JSON Schema dos argumentos)
 * POST → executa uma ferramenta: { tool, args }
 *
 * O servidor MCP que roda na sua máquina (ver mcp/command-center.mjs) descobre
 * o catálogo aqui no boot e repassa cada chamada. Assim, ferramenta nova é
 * deploy — não precisa atualizar nada no seu computador.
 *
 * Toda a rota exige MCP_API_TOKEN. Sem o token configurado ela responde 503:
 * fechada por padrão, nunca aberta por esquecimento.
 */

const Chamada = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(req: NextRequest) {
  const v = autorizar(req.headers);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: v.status });
  return NextResponse.json({ ferramentas: catalogo() });
}

export async function POST(req: NextRequest) {
  const v = autorizar(req.headers);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: v.status });

  const corpo = Chamada.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ error: "Envie { tool, args }." }, { status: 400 });
  }

  const ferramenta = acharFerramenta(corpo.data.tool);
  if (!ferramenta) {
    return NextResponse.json({ error: `Ferramenta "${corpo.data.tool}" não existe.` }, { status: 404 });
  }

  const args = ferramenta.schema.safeParse(corpo.data.args);
  if (!args.success) {
    return NextResponse.json(
      { error: `Argumentos inválidos: ${args.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` },
      { status: 400 }
    );
  }

  try {
    const texto = await ferramenta.executar(args.data as Record<string, unknown>);
    return NextResponse.json({ texto });
  } catch (e) {
    // O erro vai para o log do servidor; para fora vai só o essencial.
    console.error(`[mcp] ${ferramenta.nome} falhou`, e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `A ferramenta ${ferramenta.nome} falhou: ${msg.slice(0, 200)}` }, { status: 500 });
  }
}
