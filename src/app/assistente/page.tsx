"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertCircle, ArrowUp, Loader2, Search, Square } from "lucide-react";

/**
 * O assistente do painel.
 *
 * Mesmas ferramentas que o MCP serve ao Jarvis — aqui dentro, sem instalar
 * nada, do celular ou do computador. A tela mostra o que ele consultou, para
 * você conferir de onde veio cada número.
 */

const SUGESTOES = [
  "O que eu preciso decidir hoje?",
  "Quais clientes estão em risco?",
  "Quanto entrou esse mês e quanto tenho de caixa?",
  "Tem post esperando aprovação?",
  "Quem está travado no pipeline?",
];

/** Nome da ferramenta → como dizer que consultou. */
const LABEL_FERRAMENTA: Record<string, string> = {
  hoje: "o dia",
  maquina_status: "a máquina de conteúdo",
  post_detalhe: "o post",
  clientes: "a carteira de clientes",
  cliente_detalhe: "a ficha do cliente",
  financeiro: "o financeiro",
  pipeline: "o pipeline",
  instagram: "o Instagram",
};

export default function AssistentePage() {
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistente" }),
  });
  const [input, setInput] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

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
    <div className="mx-auto flex h-[calc(100dvh-5rem)] max-w-3xl flex-col">
      <header className="shrink-0 pb-3">
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Assistente</h1>
        <p className="mt-0.5 text-[12px] text-muted">
          Pergunte sobre o negócio. Ele consulta o painel antes de responder — e só lê, nunca publica nem cobra.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
        {messages.length === 0 && (
          <div className="space-y-2 pt-6">
            <p className="text-[12px] text-muted-2">Por exemplo:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="rounded-[9px] border border-border bg-surface/50 px-2.5 py-1.5 text-left text-[12px] text-foreground-2 transition-colors duration-150 hover:border-brand/35 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-[12px] rounded-br-[4px] bg-surface-2 px-3 py-2 text-[13px] text-foreground">
                {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
              </div>
            ) : (
              <div className="space-y-2">
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    return (
                      <div key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground-2">
                        {p.text}
                      </div>
                    );
                  }
                  if (p.type.startsWith("tool-")) {
                    const nome = p.type.slice(5);
                    const pronto = "output" in p && p.output !== undefined;
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-2">
                        {pronto ? (
                          <Search className="h-3 w-3 shrink-0" />
                        ) : (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        )}
                        {pronto ? "consultou" : "consultando"} {LABEL_FERRAMENTA[nome] ?? nome}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-2">
            <Loader2 className="h-3 w-3 animate-spin" /> pensando…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-[10px] border border-danger/25 bg-danger/8 px-3 py-2 text-[12px] text-[color:var(--danger)]">
            <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            <span>{error.message || "Não consegui responder agora."}</span>
          </div>
        )}

        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="shrink-0 border-t border-border-subtle pt-3"
      >
        <div className="flex items-end gap-2 rounded-[12px] border border-border bg-surface/60 px-3 py-2 focus-within:border-brand/45">
          <textarea
            ref={campo}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(input);
              }
            }}
            rows={1}
            placeholder="Pergunte sobre clientes, dinheiro, pipeline, conteúdo…"
            className="max-h-32 min-h-[22px] flex-1 resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-2"
          />
          <button
            type={ocupado ? "button" : "submit"}
            onClick={ocupado ? stop : undefined}
            disabled={!ocupado && !input.trim()}
            aria-label={ocupado ? "Parar" : "Enviar"}
            className="shrink-0 rounded-[8px] bg-foreground p-1.5 text-background transition-opacity duration-150 disabled:opacity-30"
          >
            {ocupado ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
