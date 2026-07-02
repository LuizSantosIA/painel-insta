"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Qual é o meu post com mais engajamento?",
  "Qual tipo de conteúdo funciona melhor no meu perfil?",
  "Quando devo postar para ter mais alcance?",
  "Como posso melhorar minha taxa de engajamento?",
  "Faça um resumo do desempenho da minha conta",
];

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMessage: Message = { role: "user", content };
    const history = [...messages, userMessage];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages([
          ...history,
          {
            role: "assistant",
            content: `Erro: ${(err as { error?: string }).error ?? "Falha na conexão"}`,
          },
        ]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const token = parsed.choices?.[0]?.delta?.content ?? "";
            if (token) {
              aiContent += token;
              setMessages([
                ...history,
                { role: "assistant", content: aiContent },
              ]);
            }
          } catch {
            // ignora linhas mal formatadas do stream
          }
        }
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="font-semibold text-lg">Assistente do seu Instagram</p>
              <p className="mt-1 text-sm text-muted max-w-sm">
                Conheço todos os dados do seu perfil. Pergunte sobre métricas, estratégias, melhores horários, tipos de conteúdo e muito mais.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-brand transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    m.role === "assistant"
                      ? "brand-gradient"
                      : "bg-surface-2 border border-border"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <Bot className="h-4 w-4 text-white" />
                  ) : (
                    <User className="h-4 w-4 text-muted" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand text-white rounded-tr-sm"
                      : "card rounded-tl-sm"
                  }`}
                >
                  {m.content === "" && loading && i === messages.length - 1 ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="mt-4 border-t border-border pt-4">
        {messages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {["Dê uma sugestão de pauta", "O que devo evitar?", "Compare meus tipos de post"].map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={loading}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted hover:border-brand hover:text-brand transition-colors disabled:opacity-40"
              >
                <Sparkles className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte sobre seu Instagram… (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm placeholder:text-muted outline-none focus:border-brand"
            style={{ minHeight: 48, maxHeight: 120 }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted text-center">
          A IA conhece seus posts, métricas, horários e tendências reais.
        </p>
      </div>
    </div>
  );
}