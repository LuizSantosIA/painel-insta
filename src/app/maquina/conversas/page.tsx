"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";
import {
  COR_STATUS_CONVERSA,
  LABEL_STATUS_CONVERSA,
  type StatusConversa,
} from "@/lib/maquina";
import type { ConversaMaquina } from "@/lib/maquina-dados";
import type { ConversasLista } from "@/app/api/maquina/conversas/route";
import { TransformarEmLead } from "@/components/maquina/transformar-em-lead";

/**
 * Conversas.
 *
 * Evolução da antiga tela de DMs: a caixa de entrada continua igual (sincronizar,
 * abrir a thread, responder), mas cada conversa agora carrega o estado dela no
 * funil — nova, aguardando resposta, lead, oportunidade — e a origem: qual post
 * trouxe a pessoa e qual automação iniciou o papo.
 *
 * A arquitetura fala em "conversa", não em "DM do Instagram": hoje só existe um
 * canal, e o dia em que existir outro nada aqui precisa mudar de nome.
 */

interface Mensagem {
  id: string;
  text: string;
  fromMe: boolean;
  fromUsername: string;
  createdAt: string;
}

function fmtHora(iso: string): string {
  const d = new Date(iso);
  const horas = (Date.now() - d.getTime()) / 3_600_000;
  if (horas < 24) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (horas < 48) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function fmtCabecalhoData(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function Avatar({ username, size = 36 }: { username: string; size?: number }) {
  const iniciais = username.slice(0, 2).toUpperCase();
  const hue = [...username].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `hsl(${hue},48%,32%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {iniciais}
    </div>
  );
}

function Etiqueta({ status }: { status: StatusConversa }) {
  const cor = COR_STATUS_CONVERSA[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.06em]"
      style={{ color: cor }}
    >
      <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: cor }} />
      {LABEL_STATUS_CONVERSA[status]}
    </span>
  );
}

function agruparPorData(mensagens: Mensagem[]) {
  const grupos: { data: string; msgs: Mensagem[] }[] = [];
  for (const msg of mensagens) {
    const chave = new Date(msg.createdAt).toDateString();
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === chave) ultimo.msgs.push(msg);
    else grupos.push({ data: chave, msgs: [msg] });
  }
  return grupos;
}

export default function ConversasPage() {
  const [dados, setDados] = useState<ConversasLista | null>(null);
  const [filtro, setFiltro] = useState<StatusConversa | "TODAS">("TODAS");
  const [selecionada, setSelecionada] = useState<ConversaMaquina | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoThread, setCarregandoThread] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  // Não volta ao estado de carregamento: recarregar depois de responder ou de
  // criar um lead não pode apagar a thread aberta e devolver o spinner à tela.
  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/maquina/conversas");
      if (r.ok) {
        const json: ConversasLista = await r.json();
        setDados(json);
        // Mantém o painel da direita coerente com a lista recém-carregada.
        setSelecionada((atual) =>
          atual ? (json.conversas.find((c) => c.id === atual.id) ?? atual) : atual
        );
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  async function sincronizar() {
    setSincronizando(true);
    try {
      const r = await fetch("/api/dms/sync", { method: "POST" });
      const json = await r.json().catch(() => ({}));
      if (r.ok) await carregar();
      else alert(json.error ?? "Erro ao sincronizar");
    } finally {
      setSincronizando(false);
    }
  }

  async function abrir(conversa: ConversaMaquina) {
    setSelecionada(conversa);
    setCarregandoThread(true);
    setMensagens([]);
    try {
      const r = await fetch(`/api/dms/${conversa.id}`);
      if (r.ok) {
        const completa = await r.json();
        setMensagens(completa.messages ?? []);
      }
    } finally {
      setCarregandoThread(false);
    }
  }

  async function responder() {
    if (!resposta.trim() || !selecionada || enviando) return;
    setEnviando(true);
    const texto = resposta.trim();
    setResposta("");
    try {
      const r = await fetch(`/api/dms/${selecionada.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texto }),
      });
      const msg = await r.json();
      if (r.ok) {
        setMensagens((prev) => [...prev, msg]);
        // Responder muda o estado da conversa no funil — a lista precisa saber.
        carregar();
      } else {
        alert(msg.error ?? "Erro ao enviar");
        setResposta(texto);
      }
    } finally {
      setEnviando(false);
    }
  }

  const conversas = dados?.conversas ?? [];
  const visiveis = filtro === "TODAS" ? conversas : conversas.filter((c) => c.status === filtro);
  const vazio = !carregando && conversas.length === 0;

  return (
    <div className="flex h-[calc(100vh-96px)] overflow-hidden rounded-[12px] border border-border-subtle">
      {/* ── Lista ── */}
      <div className="flex w-[320px] shrink-0 flex-col border-r border-border-subtle bg-surface/40">
        <div className="flex items-center justify-between px-3.5 pb-2 pt-3.5">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[13px] font-semibold tracking-tight text-foreground">Conversas</h1>
            {conversas.length > 0 && (
              <span className="text-[11px] text-muted-2">{conversas.length}</span>
            )}
          </div>
          <button
            onClick={sincronizar}
            disabled={sincronizando}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:border-brand/35 hover:text-foreground disabled:opacity-60"
          >
            {sincronizando ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {sincronizando ? "Sincronizando" : "Sincronizar"}
          </button>
        </div>

        {/* Filtros por estado no funil */}
        <div className="flex flex-wrap gap-1 px-3.5 pb-2.5">
          <FiltroChip ativo={filtro === "TODAS"} onClick={() => setFiltro("TODAS")}>
            Todas
          </FiltroChip>
          {(dados?.porStatus ?? [])
            .filter((s) => s.total > 0)
            .map((s) => (
              <FiltroChip
                key={s.status}
                ativo={filtro === s.status}
                cor={COR_STATUS_CONVERSA[s.status]}
                onClick={() => setFiltro(s.status)}
              >
                {s.label} {s.total}
              </FiltroChip>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando && (
            <div className="flex justify-center pt-10">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          )}

          {vazio && (
            <div className="px-5 py-10 text-center">
              <MessageCircle className="mx-auto mb-3 h-7 w-7 text-muted-2/50" />
              <p className="text-[12.5px] font-medium text-muted">Nenhuma conversa</p>
              <p className="mt-1 text-[11.5px] text-muted-2">
                Sincronize para buscar os directs do Instagram.
              </p>
            </div>
          )}

          {!carregando && !vazio && visiveis.length === 0 && (
            <p className="px-5 py-8 text-center text-[11.5px] text-muted-2">
              Nenhuma conversa neste estado.
            </p>
          )}

          {visiveis.map((c) => {
            const ativa = selecionada?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => abrir(c)}
                className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left transition-colors duration-150 ${
                  ativa
                    ? "border-l-brand bg-brand/10"
                    : "border-l-transparent hover:bg-surface-2/45"
                }`}
              >
                <Avatar username={c.igUsername} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-foreground">
                      @{c.igUsername}
                    </span>
                    {c.ultimaMensagem && (
                      <span className="shrink-0 text-[10px] text-muted-2">
                        {fmtHora(c.ultimaMensagem.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {c.ultimaMensagem
                      ? `${c.ultimaMensagem.fromMe ? "Você: " : ""}${c.ultimaMensagem.texto}`
                      : "sem mensagens"}
                  </p>
                  <div className="mt-1">
                    <Etiqueta status={c.status} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selecionada ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <MessageCircle className="mb-3 h-10 w-10 text-muted-2/30" />
            <p className="text-[12.5px] text-muted">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle bg-surface/40 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar username={selecionada.igUsername} size={34} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      @{selecionada.igUsername}
                    </p>
                    <Etiqueta status={selecionada.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-2">
                    {selecionada.postOrigem ? (
                      <>
                        veio do post “{selecionada.postOrigem.caption?.slice(0, 40) ?? "sem legenda"}
                        ”
                        {selecionada.automacaoOrigem
                          ? ` · automação ${selecionada.automacaoOrigem.nome}`
                          : ""}
                      </>
                    ) : (
                      "origem desconhecida"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-start gap-2">
                <a
                  href={`https://instagram.com/${selecionada.igUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition-colors hover:border-brand/35 hover:text-foreground"
                >
                  Perfil
                  <ChevronRight className="h-3 w-3" />
                </a>
                <TransformarEmLead conversa={selecionada} onPronto={carregar} />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-5 py-4">
              {carregandoThread ? (
                <div className="flex justify-center pt-10">
                  <Loader2 className="h-5 w-5 animate-spin text-brand" />
                </div>
              ) : (
                agruparPorData(mensagens).map((grupo) => (
                  <div key={grupo.data}>
                    <div className="my-3 flex items-center gap-2.5">
                      <div className="h-px flex-1 bg-border-subtle" />
                      <span className="whitespace-nowrap text-[10px] font-medium text-muted-2">
                        {fmtCabecalhoData(grupo.msgs[0].createdAt)}
                      </span>
                      <div className="h-px flex-1 bg-border-subtle" />
                    </div>

                    {grupo.msgs.map((msg, i) => {
                      const anterior = i > 0 ? grupo.msgs[i - 1] : null;
                      const mesmoAutor = anterior && anterior.fromMe === msg.fromMe;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                          style={{ marginBottom: mesmoAutor ? 2 : 8 }}
                        >
                          <div className="max-w-[72%]">
                            <div
                              className="px-3.5 py-2 text-[12.5px] leading-relaxed"
                              style={{
                                borderRadius: msg.fromMe
                                  ? "14px 14px 4px 14px"
                                  : "14px 14px 14px 4px",
                                background: msg.fromMe
                                  ? "rgba(79,140,255,0.16)"
                                  : "rgba(255,255,255,0.05)",
                                border: msg.fromMe
                                  ? "1px solid rgba(79,140,255,0.28)"
                                  : "1px solid rgba(255,255,255,0.07)",
                                color: "var(--foreground)",
                                wordBreak: "break-word",
                              }}
                            >
                              {msg.text}
                            </div>
                            <p
                              className={`mt-0.5 px-1 text-[10px] text-muted-2 ${
                                msg.fromMe ? "text-right" : "text-left"
                              }`}
                            >
                              {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={fim} />
            </div>

            <div className="flex items-end gap-2 border-t border-border-subtle bg-surface/40 px-5 py-3">
              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    responder();
                  }
                }}
                rows={2}
                placeholder="Mensagem… (Enter envia, Shift+Enter quebra linha)"
                className="min-w-0 flex-1 resize-none rounded-[10px] border border-border bg-surface-2/50 px-3 py-2 text-[12.5px] text-foreground outline-none transition-colors focus:border-brand/50"
              />
              <button
                onClick={responder}
                disabled={!resposta.trim() || enviando}
                className="rounded-[10px] border border-brand/45 bg-brand/10 p-2.5 text-brand transition-colors hover:bg-brand/15 disabled:opacity-40"
                aria-label="Enviar"
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FiltroChip({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10.5px] font-medium transition-colors duration-150 ${
        ativo
          ? "border-brand/45 bg-brand/10 text-foreground"
          : "border-border text-muted-2 hover:border-brand/30 hover:text-foreground-2"
      }`}
    >
      {cor && (
        <span className="inline-block h-[4px] w-[4px] rounded-full" style={{ background: cor }} />
      )}
      {children}
    </button>
  );
}
