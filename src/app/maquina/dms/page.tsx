"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, Send, MessageCircle, Loader2, ChevronRight } from "lucide-react";

interface IgMessage {
  id: string;
  text: string;
  fromMe: boolean;
  fromUsername: string;
  createdAt: string;
}

interface IgConversation {
  id: string;
  igUserId: string;
  igUsername: string;
  updatedAt: string;
  messages: IgMessage[];
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 24) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffH < 48) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function fmtDateHeader(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  if (isToday) return "Hoje";
  if (isYest) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function Avatar({ username, size = 36 }: { username: string; size?: number }) {
  const initials = username.slice(0, 2).toUpperCase();
  const hue = [...username].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},55%,35%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "#fff",
    }}>
      {initials}
    </div>
  );
}

export default function DmsPage() {
  const [conversations, setConversations] = useState<IgConversation[]>([]);
  const [selected, setSelected] = useState<IgConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  async function loadConversations() {
    setLoading(true);
    try {
      const r = await fetch("/api/dms");
      if (r.ok) setConversations(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const r = await fetch("/api/dms/sync", { method: "POST" });
      const data = await r.json();
      if (r.ok) await loadConversations();
      else alert(data.error ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function openConversation(conv: IgConversation) {
    setLoadingThread(true);
    setSelected(conv);
    try {
      const r = await fetch(`/api/dms/${conv.id}`);
      if (r.ok) {
        const full = await r.json();
        setSelected(full);
      }
    } finally {
      setLoadingThread(false);
    }
  }

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    const text = reply.trim();
    setReply("");
    try {
      const r = await fetch(`/api/dms/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const msg = await r.json();
      if (r.ok) {
        setSelected(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
        setConversations(prev => prev.map(c =>
          c.id === selected.id
            ? { ...c, messages: [msg], updatedAt: msg.createdAt }
            : c
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      } else {
        alert(msg.error ?? "Erro ao enviar");
        setReply(text);
      }
    } finally {
      setSending(false);
    }
  }

  // Agrupa mensagens por data para mostrar separadores
  function groupByDate(messages: IgMessage[]) {
    const groups: { date: string; msgs: IgMessage[] }[] = [];
    for (const msg of messages) {
      const dateKey = new Date(msg.createdAt).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.date === dateKey) last.msgs.push(msg);
      else groups.push({ date: dateKey, msgs: [msg] });
    }
    return groups;
  }

  const empty = !loading && conversations.length === 0;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 32px)", gap: 0, overflow: "hidden" }}>

      {/* ── Coluna esquerda: lista de conversas ── */}
      <div style={{
        width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(30,45,74,0.7)",
        background: "rgba(4,8,18,0.5)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} style={{ color: "#4F8CFF" }} />
            <h1 style={{ fontSize: 15, fontWeight: 700, color: "#e8f0ff", margin: 0 }}>DMs</h1>
            {conversations.length > 0 && (
              <span style={{ fontSize: 11, color: "#4a617f", fontWeight: 600 }}>{conversations.length}</span>
            )}
          </div>
          <button
            onClick={sync}
            disabled={syncing}
            style={{
              background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.25)",
              borderRadius: 8, padding: "5px 10px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, color: "#6BABFF", fontSize: 12, fontWeight: 600,
            }}
          >
            {syncing
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <RefreshCw size={13} />
            }
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </button>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
              <Loader2 size={22} style={{ color: "#4F8CFF", animation: "spin 1s linear infinite" }} />
            </div>
          )}
          {empty && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <MessageCircle size={32} style={{ color: "#2a3a52", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 13, color: "#4a617f", fontWeight: 600 }}>Nenhuma conversa</p>
              <p style={{ fontSize: 12, color: "#2a3a52", marginTop: 4 }}>Clique em Sincronizar para buscar do Instagram</p>
            </div>
          )}
          {conversations.map(conv => {
            const lastMsg = conv.messages[0];
            const isSelected = selected?.id === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                style={{
                  width: "100%", background: isSelected ? "rgba(79,140,255,0.1)" : "transparent",
                  border: "none", borderLeft: isSelected ? "3px solid #4F8CFF" : "3px solid transparent",
                  padding: "10px 14px", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 10,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(79,140,255,0.05)"; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Avatar username={conv.igUsername} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e8f0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      @{conv.igUsername}
                    </span>
                    {lastMsg && (
                      <span style={{ fontSize: 10, color: "#3d5275", flexShrink: 0 }}>
                        {fmtTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p style={{ fontSize: 11, color: "#4a617f", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                      {lastMsg.fromMe ? "Você: " : ""}{lastMsg.text}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Coluna direita: thread ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#2a3a52" }}>
            <MessageCircle size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: "#4a617f" }}>Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div style={{
              padding: "14px 20px", borderBottom: "1px solid rgba(30,45,74,0.7)",
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(4,8,18,0.4)",
            }}>
              <Avatar username={selected.igUsername} size={36} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#e8f0ff", margin: 0 }}>@{selected.igUsername}</p>
                <a
                  href={`https://instagram.com/${selected.igUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#4F8CFF", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                >
                  Ver perfil <ChevronRight size={10} />
                </a>
              </div>
            </div>

            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
              {loadingThread ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
                  <Loader2 size={22} style={{ color: "#4F8CFF", animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                groupByDate(selected.messages).map(group => (
                  <div key={group.date}>
                    {/* Separador de data */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 10px" }}>
                      <div style={{ flex: 1, height: 1, background: "rgba(30,45,74,0.5)" }} />
                      <span style={{ fontSize: 10, color: "#3d5275", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {fmtDateHeader(group.msgs[0].createdAt)}
                      </span>
                      <div style={{ flex: 1, height: 1, background: "rgba(30,45,74,0.5)" }} />
                    </div>

                    {group.msgs.map((msg, i) => {
                      const prevMsg = i > 0 ? group.msgs[i - 1] : null;
                      const sameAuthor = prevMsg && prevMsg.fromMe === msg.fromMe;
                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: "flex",
                            justifyContent: msg.fromMe ? "flex-end" : "flex-start",
                            marginBottom: sameAuthor ? 2 : 8,
                          }}
                        >
                          {!msg.fromMe && !sameAuthor && (
                            <div style={{ marginRight: 8, alignSelf: "flex-end" }}>
                              <Avatar username={selected.igUsername} size={24} />
                            </div>
                          )}
                          {!msg.fromMe && sameAuthor && <div style={{ width: 32, flexShrink: 0 }} />}
                          <div style={{ maxWidth: "72%" }}>
                            <div style={{
                              padding: "9px 14px",
                              borderRadius: msg.fromMe
                                ? "18px 18px 4px 18px"
                                : "18px 18px 18px 4px",
                              background: msg.fromMe
                                ? "linear-gradient(135deg, #4F8CFF, #7C5CFF)"
                                : "rgba(255,255,255,0.07)",
                              border: msg.fromMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                              fontSize: 13,
                              color: "#f1f5ff",
                              lineHeight: 1.45,
                              wordBreak: "break-word",
                            }}>
                              {msg.text}
                            </div>
                            {(!sameAuthor || i === group.msgs.length - 1) && (
                              <p style={{
                                fontSize: 10, color: "#3d5275", margin: "3px 4px 0",
                                textAlign: msg.fromMe ? "right" : "left",
                              }}>
                                {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input de resposta */}
            <div style={{
              padding: "12px 20px", borderTop: "1px solid rgba(30,45,74,0.7)",
              background: "rgba(4,8,18,0.4)",
              display: "flex", gap: 10, alignItems: "flex-end",
            }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                }}
                placeholder="Mensagem… (Enter para enviar, Shift+Enter para quebrar linha)"
                rows={2}
                style={{
                  flex: 1, resize: "none", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(79,140,255,0.2)", borderRadius: 12,
                  padding: "10px 14px", fontSize: 13, color: "#e8f0ff",
                  outline: "none", fontFamily: "inherit", lineHeight: 1.4,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(79,140,255,0.5)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(79,140,255,0.2)")}
              />
              <button
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                style={{
                  background: reply.trim() && !sending
                    ? "linear-gradient(135deg, #4F8CFF, #7C5CFF)"
                    : "rgba(79,140,255,0.15)",
                  border: "none", borderRadius: 12, padding: "10px 14px",
                  cursor: reply.trim() && !sending ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >
                {sending
                  ? <Loader2 size={18} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
                  : <Send size={18} style={{ color: reply.trim() ? "#fff" : "#3d5275" }} />
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
