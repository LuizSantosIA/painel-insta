"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

/**
 * O assistente, vestido de terminal — a estética do OpenJarvis.
 *
 * Mesmas ferramentas que o MCP serve ao Jarvis e ao Claude Desktop; aqui elas
 * aparecem como linhas de log, e a entrada fica depois do prompt, como num
 * shell de verdade. O conteúdo é o painel; a casca é só a roupa.
 */

const LOGO = String.raw`
 ╔═╗╔═╗╔╦╗╔╦╗╔═╗╔╗╔╔╦╗
 ║  ║ ║║║║║║║╠═╣║║║ ║║
 ╚═╝╚═╝╩ ╩╩ ╩╩ ╩╝╚╝═╩╝
   ╔═╗╔═╗╔╗╔╔╦╗╔═╗╦═╗
   ║  ║╣ ║║║ ║ ║╣ ╠╦╝
   ╚═╝╚═╝╝╚╝ ╩ ╚═╝╩╚═`;

const SUGESTOES = [
  "O que eu preciso decidir hoje?",
  "Quais clientes estão em risco?",
  "Quanto entrou esse mês?",
  "Tem post esperando aprovação?",
  "Quem está travado no pipeline?",
];

/** Nome da ferramenta → o que escrever na linha de log. */
const LABEL_FERRAMENTA: Record<string, string> = {
  hoje: "hoje --prioridades",
  maquina_status: "maquina --status",
  post_detalhe: "post --detalhe",
  clientes: "clientes --saude",
  cliente_detalhe: "cliente --360",
  financeiro: "financeiro --mes",
  pipeline: "pipeline --abertos",
  instagram: "instagram --conversas",
};

const PROMPT = "luiz@command-center:~$";

/**
 * A rota responde erro como JSON; o transporte entrega o corpo cru na mensagem.
 * Aqui ele vira uma frase — ninguém precisa ler chave e chave no terminal.
 */
function mensagemDeErro(e: Error): string {
  const bruto = e.message?.trim();
  if (!bruto) return "não consegui responder agora.";
  try {
    const j = JSON.parse(bruto) as { error?: string };
    if (typeof j.error === "string" && j.error) return j.error;
  } catch {
    /* não era JSON — segue o texto como veio */
  }
  return bruto;
}

export default function AssistentePage() {
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistente" }),
  });
  const [input, setInput] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const ocupado = status === "submitted" || status === "streaming";

  function enviar(texto: string) {
    const t = texto.trim();
    if (!t || ocupado) return;
    sendMessage({ text: t });
    setInput("");
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <header className="pb-3">
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Assistente</h1>
        <p className="mt-0.5 text-[12px] text-muted">
          Pergunte sobre o negócio. Ele consulta o painel antes de responder — e só lê, nunca publica nem cobra.
        </p>
      </header>

      {/* a janela */}
      <div className="min-w-0 overflow-hidden rounded-[10px] border border-[#1f2937] bg-[#07090d] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-1.5 border-b border-[#161d29] bg-[#0b0f16] px-3 py-2">
          <span className="h-[9px] w-[9px] rounded-full bg-[#ff5f57]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#febc2e]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#28c840]" />
          <span className="ml-2 font-[family-name:var(--font-mono)] text-[11px] text-[#5b6b84]">
            command-center — assistente
          </span>
        </div>

        <div
          onClick={() => campo.current?.focus()}
          className="h-[min(62vh,560px)] cursor-text overflow-y-auto overflow-x-hidden p-4 font-[family-name:var(--font-mono)] text-[12px] leading-[1.65] sm:text-[12.5px]"
        >
          {messages.length === 0 && (
            <>
              {/* leading-none é o que faz os traços de caixa se encostarem e formarem as letras */}
              <pre className="max-w-full overflow-x-auto text-[11px] leading-none text-[#4f8cff] sm:text-[15px]">{LOGO}</pre>
              <p className="mt-1 text-[#7cc0ff]">O seu negócio, por conversa.</p>
              <p className="mt-3 text-[#5b6b84]">
                8 ferramentas de leitura carregadas · nada aqui publica, cobra ou envia mensagem
              </p>
              <p className="mt-3 text-[#5b6b84]">tente:</p>
              <div className="mt-1 space-y-0.5">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      enviar(s);
                    }}
                    className="block text-left text-[#8fa3bf] transition-colors duration-150 hover:text-[#e6edf7]"
                  >
                    <span className="text-[#3d4a5e]">· </span>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {messages.map((m) => (
            <div key={m.id} className={messages.length ? "mt-3 first:mt-0" : ""}>
              {m.role === "user" ? (
                <p className="break-words">
                  <span className="text-[#28c840]">{PROMPT}</span>{" "}
                  <span className="text-[#e6edf7]">
                    {m.parts.map((p) => (p.type === "text" ? p.text : null))}
                  </span>
                </p>
              ) : (
                <div className="space-y-1">
                  {m.parts.map((p, i) => {
                    if (p.type === "text") {
                      return (
                        <p key={i} className="whitespace-pre-wrap break-words text-[#c9d6e8]">
                          {p.text}
                        </p>
                      );
                    }
                    if (p.type.startsWith("tool-")) {
                      const nome = p.type.slice(5);
                      const pronto = "output" in p && p.output !== undefined;
                      return (
                        <p key={i} className="text-[#f0a92e]">
                          <span className="text-[#3d4a5e]">{pronto ? "✓" : "›"}</span>{" "}
                          {LABEL_FERRAMENTA[nome] ?? nome}
                          {!pronto && <span className="animate-pulse"> …</span>}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ))}

          {status === "submitted" && (
            <p className="mt-2 text-[#5b6b84]">
              pensando<span className="animate-pulse">▌</span>
            </p>
          )}

          {error && (
            <p className="mt-2 whitespace-pre-wrap break-words text-[#ff6b6b]">
              erro: {mensagemDeErro(error)}
            </p>
          )}

          {/* a linha de entrada, dentro do terminal */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(input);
            }}
            className="mt-3 flex items-baseline gap-2"
          >
            <span className="shrink-0 text-[#28c840]">{PROMPT}</span>
            <input
              ref={campo}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={ocupado}
              autoFocus
              spellCheck={false}
              placeholder={ocupado ? "" : "pergunte alguma coisa"}
              className="min-w-0 flex-1 bg-transparent text-[#e6edf7] caret-[#4f8cff] outline-none placeholder:text-[#3d4a5e] disabled:opacity-40"
            />
            {ocupado && (
              <button
                type="button"
                onClick={stop}
                className="shrink-0 text-[11px] text-[#5b6b84] hover:text-[#ff6b6b]"
              >
                ^C parar
              </button>
            )}
          </form>

          <div ref={fim} />
        </div>
      </div>

      <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-muted-2">
        as mesmas ferramentas estão disponíveis por MCP no Claude Desktop e no OpenJarvis — veja mcp/README.md
      </p>
    </div>
  );
}
