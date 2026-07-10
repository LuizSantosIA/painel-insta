"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, CheckCircle, Clock, Phone, Mail, DollarSign, MessageSquare, X, Save } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import { corSaude, labelSaude, type SaudeScore } from "@/lib/saude";
import type { ClienteSaudeItem } from "@/app/api/clientes/saude/route";

type Filtro = "TODOS" | SaudeScore;

function StatusIcon({ score }: { score: SaudeScore }) {
  const color = corSaude(score);
  if (score === "VERMELHO") return <AlertTriangle size={14} style={{ color }} />;
  if (score === "AMARELO") return <Clock size={14} style={{ color }} />;
  return <CheckCircle size={14} style={{ color }} />;
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function SaudePage() {
  const [clientes, setClientes] = useState<ClienteSaudeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  // Nota modal
  const [editando, setEditando] = useState<{ id: string; nome: string; nota: string } | null>(null);
  const [salvandoNota, setSalvandoNota] = useState(false);

  // Registrar contato
  const [contatandoId, setContatandoId] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/clientes/saude");
    if (res.ok) setClientes(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  async function registrarContato(id: string) {
    setContatandoId(id);
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ultimoContatoEm: new Date().toISOString() }),
    });
    setContatandoId(null);
    fetchClientes();
  }

  async function salvarNota() {
    if (!editando) return;
    setSalvandoNota(true);
    await fetch(`/api/clients/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saudeNota: editando.nota.trim() || null }),
    });
    setSalvandoNota(false);
    setEditando(null);
    fetchClientes();
  }

  const vermelhos = clientes.filter((c) => c.saude === "VERMELHO").length;
  const amarelos = clientes.filter((c) => c.saude === "AMARELO").length;
  const verdes = clientes.filter((c) => c.saude === "VERDE").length;

  const visivel = filtro === "TODOS" ? clientes : clientes.filter((c) => c.saude === filtro);

  const KPI_CARDS = [
    { label: "Em risco",   count: vermelhos, score: "VERMELHO" as SaudeScore, emoji: "🔴" },
    { label: "Atenção",    count: amarelos,  score: "AMARELO"  as SaudeScore, emoji: "🟡" },
    { label: "Saudáveis",  count: verdes,    score: "VERDE"    as SaudeScore, emoji: "🟢" },
  ];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5ff", margin: 0 }}>Saúde dos Clientes</h1>
        <p style={{ color: "#4a617f", fontSize: 13, marginTop: 4 }}>
          Quem precisa de atenção agora?
        </p>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {KPI_CARDS.map((kpi) => {
          const cor = corSaude(kpi.score);
          const ativo = filtro === kpi.score;
          return (
            <button
              key={kpi.score}
              onClick={() => setFiltro(ativo ? "TODOS" : kpi.score)}
              className="card"
              style={{
                padding: "18px 20px", textAlign: "left", cursor: "pointer",
                border: ativo ? `1px solid ${cor}55` : undefined,
                background: ativo ? `${cor}0a` : undefined,
                transition: "all 0.15s",
              }}
            >
              <p style={{ fontSize: 26, margin: 0 }}>{kpi.emoji}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: cor, margin: "6px 0 2px", lineHeight: 1 }}>
                {loading ? "—" : kpi.count}
              </p>
              <p style={{ fontSize: 12, color: "#4a617f", fontWeight: 600 }}>{kpi.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filtro rápido ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["TODOS", "VERMELHO", "AMARELO", "VERDE"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              background: filtro === f ? "rgba(79,140,255,0.18)" : "transparent",
              border: `1px solid ${filtro === f ? "rgba(79,140,255,0.4)" : "rgba(79,140,255,0.12)"}`,
              color: filtro === f ? "#4F8CFF" : "#4a617f",
            }}
          >
            {f === "TODOS" ? "Todos" : labelSaude(f)}
          </button>
        ))}
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Loader2 size={24} style={{ color: "#4F8CFF", animation: "spin 1s linear infinite" }} />
        </div>
      ) : visivel.length === 0 ? (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "#4a617f" }}>
          <CheckCircle size={32} style={{ color: "#22C55E", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14 }}>Nenhum cliente nesta categoria.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visivel.map((c) => {
            const cor = corSaude(c.saude);
            const dias = diasDesde(c.ultimoContatoEm);
            const isContatando = contatandoId === c.id;

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: "16px 18px",
                  borderLeft: `3px solid ${cor}`,
                  display: "flex", alignItems: "flex-start", gap: 14,
                }}
              >
                {/* Status icon */}
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  <StatusIcon score={c.saude} />
                </div>

                {/* Info principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#e8f0ff" }}>{c.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "2px 8px",
                      background: `${cor}18`, color: cor,
                    }}>
                      {labelSaude(c.saude)}
                    </span>
                    {c.mrrAtual > 0 && (
                      <span style={{ fontSize: 11, color: "#4a617f", display: "flex", alignItems: "center", gap: 4 }}>
                        <DollarSign size={10} />
                        {fmtBRL(c.mrrAtual)}/mês
                      </span>
                    )}
                  </div>

                  {/* Sinais de risco */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#4a617f", marginBottom: 6 }}>
                    {c.temInadimplente && (
                      <span style={{ color: "#f87171", fontWeight: 600 }}>⚠ Receita inadimplente</span>
                    )}
                    {c.receitaVencida && !c.temInadimplente && (
                      <span style={{ color: "#fbbf24", fontWeight: 600 }}>⚠ Receita prevista vencida</span>
                    )}
                    {dias !== null && (
                      <span style={{ color: dias > 60 ? "#f87171" : dias > 30 ? "#fbbf24" : "#4a617f" }}>
                        Último contato: {dias === 0 ? "hoje" : `${dias}d atrás`}
                      </span>
                    )}
                    {dias === null && (
                      <span>Contato não registrado</span>
                    )}
                    {c.instagram && <span>@{c.instagram}</span>}
                    {c.email && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Mail size={10} />{c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Phone size={10} />{c.phone}
                      </span>
                    )}
                  </div>

                  {/* Nota de saúde */}
                  {c.saudeNota && (
                    <p style={{ fontSize: 11, color: "#6b82a8", fontStyle: "italic", margin: 0 }}>
                      "{c.saudeNota}"
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  <button
                    onClick={() => setEditando({ id: c.id, nome: c.name, nota: c.saudeNota ?? "" })}
                    title="Adicionar nota"
                    style={{
                      background: "transparent", border: "1px solid rgba(79,140,255,0.15)",
                      borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "#4a617f", fontSize: 11,
                      display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(79,140,255,0.4)"; e.currentTarget.style.color = "#4F8CFF"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(79,140,255,0.15)"; e.currentTarget.style.color = "#4a617f"; }}
                  >
                    <MessageSquare size={11} />
                    Nota
                  </button>
                  <button
                    onClick={() => registrarContato(c.id)}
                    disabled={isContatando}
                    style={{
                      background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                      borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: "#4ade80",
                      fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                      transition: "all 0.15s",
                    }}
                  >
                    {isContatando
                      ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                      : <Phone size={11} />}
                    Registrar contato
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de nota ── */}
      {editando && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={() => setEditando(null)}
          />
          <div style={{
            position: "relative", width: 420, background: "var(--surface-1)",
            border: "1px solid rgba(79,140,255,0.15)", borderRadius: 18, padding: "24px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f1f5ff", margin: 0 }}>
                Nota — {editando.nome}
              </h3>
              <button
                onClick={() => setEditando(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#4a617f", padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              className="input"
              rows={4}
              placeholder="Ex: Em negociação de renovação, aguardando retorno até sexta."
              value={editando.nota}
              onChange={e => setEditando(v => v ? { ...v, nota: e.target.value } : null)}
              style={{ resize: "vertical", width: "100%", marginBottom: 14 }}
              autoFocus
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setEditando(null)}
                style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#6b82a8", borderRadius: 10, padding: "8px 0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={salvarNota}
                disabled={salvandoNota}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}
              >
                {salvandoNota ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                Salvar nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
