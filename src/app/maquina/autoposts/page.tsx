"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Wand2, ChevronLeft, ChevronRight,
  Check, X, Trash2, AlertCircle, Edit2, Save,
  ChevronDown, ChevronUp, Plus,
} from "lucide-react";

interface Slide {
  titulo: string;
  corpo: string;
}

interface Rascunho {
  id: string;
  topico: string;
  slides: string;
  legenda: string;
  status: "RASCUNHO" | "APROVADO" | "REJEITADO" | "PUBLICADO";
  geradoEm: string;
}

const STATUS_META: Record<string, { label: string; cor: string; bg: string; border: string }> = {
  RASCUNHO:  { label: "Aguardando aprovação", cor: "#4F8CFF", bg: "rgba(79,140,255,0.1)",   border: "rgba(79,140,255,0.25)"  },
  APROVADO:  { label: "Aprovado",              cor: "#22C55E", bg: "rgba(34,197,94,0.1)",    border: "rgba(34,197,94,0.25)"   },
  REJEITADO: { label: "Rejeitado",             cor: "#6b7280", bg: "rgba(107,114,128,0.1)",  border: "rgba(107,114,128,0.2)"  },
  PUBLICADO: { label: "Publicado",             cor: "#7C5CFF", bg: "rgba(124,92,255,0.1)",   border: "rgba(124,92,255,0.25)"  },
};

/* ── Componente do avatar de perfil ── */
function ProfileAvatar({ size = 38 }: { size?: number }) {
  const [err, setErr] = useState(false);
  const r = size / 2;
  const fontSize = Math.round(size * 0.32);

  if (err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #4F8CFF, #7C5CFF)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, border: "2px solid #4F8CFF",
        fontSize, fontWeight: 700, color: "#fff",
      }}>
        LS
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid #4F8CFF" }}>
      <img
        src="/foto-perfil.jpg"
        alt="perfil"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={() => setErr(true)}
      />
    </div>
  );
}

/* ── Preview de um slide estilo Instagram ── */
function SlideCard({
  slide, index, total, compact = false,
}: {
  slide: Slide; index: number; total: number; compact?: boolean;
}) {
  const isFirst = index === 0;

  return (
    <div style={{
      width: "100%", aspectRatio: "1 / 1",
      background: "#060e1f",
      borderRadius: compact ? 12 : 16,
      overflow: "hidden", position: "relative",
      display: "flex", flexDirection: "column",
      border: "1px solid rgba(79,140,255,0.18)",
      userSelect: "none",
    }}>
      {/* Gradiente ambiente */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 15% 15%, rgba(79,140,255,0.14) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(124,92,255,0.09) 0%, transparent 55%)",
      }} />
      {/* Linha do topo */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, #4F8CFF, #7C5CFF)",
      }} />

      {/* Cabeçalho */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: compact ? "16px 16px 0" : "22px 22px 0",
        position: "relative", zIndex: 1, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 12 }}>
          <ProfileAvatar size={compact ? 32 : 40} />
          <div>
            <div style={{ fontSize: compact ? 10 : 13, fontWeight: 700, color: "#f1f5ff", lineHeight: 1.2 }}>
              Luiz Santos
            </div>
            <div style={{ fontSize: compact ? 9 : 11, color: "#4F8CFF", fontWeight: 500 }}>
              @luizsantos.ia
            </div>
          </div>
        </div>
        <div style={{
          background: "rgba(79,140,255,0.12)", border: "1px solid rgba(79,140,255,0.28)",
          borderRadius: 20, padding: compact ? "3px 9px" : "4px 12px",
          fontSize: compact ? 9 : 11, fontWeight: 700, color: "#4F8CFF",
        }}>
          {index + 1} / {total}
        </div>
      </div>

      {/* Divisória */}
      <div style={{
        margin: compact ? "10px 16px 0" : "14px 22px 0",
        height: 1, background: "rgba(79,140,255,0.15)", flexShrink: 0,
      }} />

      {/* Conteúdo */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", overflow: "hidden",
        padding: compact ? "0 16px" : "0 22px",
        gap: compact ? 8 : 14,
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          fontSize: isFirst
            ? (compact ? 15 : 22)
            : (compact ? 13 : 18),
          fontWeight: 800, color: "#ffffff",
          lineHeight: 1.25, letterSpacing: "-0.3px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {slide.titulo}
        </div>
        <div style={{
          fontSize: compact ? 10 : 13,
          color: "#8aa4bf", lineHeight: 1.65,
          display: "-webkit-box",
          WebkitLineClamp: compact ? 4 : 5,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {slide.corpo}
        </div>
      </div>

      {/* Rodapé com dots */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: compact ? "0 16px 14px" : "0 22px 18px",
        flexShrink: 0, position: "relative", zIndex: 1,
      }}>
        <div style={{ display: "flex", gap: compact ? 4 : 5 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              width: i === index ? (compact ? 12 : 16) : (compact ? 5 : 6),
              height: compact ? 5 : 6, borderRadius: 3,
              background: i === index ? "#4F8CFF" : "rgba(79,140,255,0.22)",
              transition: "all 0.2s",
            }} />
          ))}
        </div>
        <span style={{ fontSize: compact ? 8 : 10, color: "rgba(79,140,255,0.45)", fontWeight: 600 }}>
          @luizsantos.ia
        </span>
      </div>
    </div>
  );
}

/* ── Card de rascunho (expandível) ── */
function RascunhoCard({
  r,
  expanded,
  slideIdx,
  onToggle,
  onPrevSlide,
  onNextSlide,
  onMudarStatus,
  onDeletar,
  actionId,
}: {
  r: Rascunho;
  expanded: boolean;
  slideIdx: number;
  onToggle: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onMudarStatus: (id: string, status: string) => void;
  onDeletar: (id: string) => void;
  actionId: string | null;
}) {
  const [editingLegenda, setEditingLegenda] = useState(false);
  const [legendaEdit, setLegendaEdit] = useState(r.legenda);
  const [saving, setSaving] = useState(false);

  const slides: Slide[] = (() => {
    try { return JSON.parse(r.slides); } catch { return []; }
  })();

  const st = STATUS_META[r.status] ?? STATUS_META.RASCUNHO;
  const isActing = actionId === r.id;
  const isDeleting = actionId === r.id + "_del";

  async function salvarLegenda() {
    setSaving(true);
    await fetch(`/api/autoposts/rascunhos/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legenda: legendaEdit }),
    });
    setSaving(false);
    setEditingLegenda(false);
    r.legenda = legendaEdit; // optimistic
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Cabeçalho colapsível */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", cursor: "pointer",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e8f0ff" }}>
            {r.topico}
          </span>
          <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 12,
              color: st.cor, background: st.bg, border: `1px solid ${st.border}`,
            }}>
              {st.label}
            </span>
            <span style={{ fontSize: 11, color: "#4a617f" }}>
              {slides.length} slides ·{" "}
              {new Date(r.geradoEm).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={16} style={{ color: "#4a617f", flexShrink: 0 }} />
          : <ChevronDown size={16} style={{ color: "#4a617f", flexShrink: 0 }} />}
      </div>

      {/* Conteúdo expandido */}
      {expanded && slides.length > 0 && (
        <div style={{ padding: "0 16px 18px", borderTop: "1px solid rgba(79,140,255,0.08)" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            gap: 20, marginTop: 16,
          }}>
            {/* Coluna esquerda: preview */}
            <div>
              <SlideCard slide={slides[slideIdx]} index={slideIdx} total={slides.length} />
              {/* Navegação */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 10 }}>
                <button
                  onClick={onPrevSlide}
                  disabled={slideIdx === 0}
                  style={{
                    width: 32, height: 32, borderRadius: 8, cursor: slideIdx === 0 ? "not-allowed" : "pointer",
                    border: "1px solid rgba(79,140,255,0.2)",
                    background: slideIdx === 0 ? "transparent" : "rgba(79,140,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: slideIdx === 0 ? "#2a3a52" : "#4F8CFF", transition: "all 0.15s",
                  }}
                >
                  <ChevronLeft size={15} />
                </button>
                <span style={{ fontSize: 11, color: "#4a617f", minWidth: 60, textAlign: "center" }}>
                  {slideIdx + 1} / {slides.length}
                </span>
                <button
                  onClick={onNextSlide}
                  disabled={slideIdx === slides.length - 1}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    cursor: slideIdx === slides.length - 1 ? "not-allowed" : "pointer",
                    border: "1px solid rgba(79,140,255,0.2)",
                    background: slideIdx === slides.length - 1 ? "transparent" : "rgba(79,140,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: slideIdx === slides.length - 1 ? "#2a3a52" : "#4F8CFF", transition: "all 0.15s",
                  }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Mini-strip dos slides */}
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                {slides.map((s, i) => (
                  <div key={i} style={{ flex: 1, opacity: i === slideIdx ? 1 : 0.45, transition: "opacity 0.15s" }}>
                    <SlideCard slide={s} index={i} total={slides.length} compact />
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna direita: legenda + ações */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              {/* Legenda */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#4a617f", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Legenda do post
                  </span>
                  {!editingLegenda && (
                    <button
                      onClick={() => { setEditingLegenda(true); setLegendaEdit(r.legenda); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#4a617f", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
                    >
                      <Edit2 size={11} /> Editar
                    </button>
                  )}
                </div>

                {editingLegenda ? (
                  <div>
                    <textarea
                      value={legendaEdit}
                      onChange={e => setLegendaEdit(e.target.value)}
                      rows={10}
                      className="input"
                      style={{ width: "100%", fontSize: 12, lineHeight: 1.65, resize: "vertical" }}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        onClick={salvarLegenda}
                        disabled={saving}
                        className="btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 14px" }}
                      >
                        {saving
                          ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                          : <Save size={12} />}
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingLegenda(false)}
                        style={{
                          background: "none", border: "1px solid rgba(79,140,255,0.2)",
                          borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#4a617f", cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize: 12, color: "#8aa4bf", lineHeight: 1.7,
                    background: "rgba(79,140,255,0.04)", borderRadius: 10, padding: "12px 14px",
                    border: "1px solid rgba(79,140,255,0.08)", maxHeight: 220, overflowY: "auto",
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {r.legenda}
                  </div>
                )}
              </div>

              {/* Ações — RASCUNHO */}
              {r.status === "RASCUNHO" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                  <button
                    onClick={() => onMudarStatus(r.id, "APROVADO")}
                    disabled={isActing}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                      color: "#22C55E", transition: "all 0.15s",
                    }}
                  >
                    {isActing
                      ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      : <Check size={14} />}
                    Aprovar post
                  </button>
                  <button
                    onClick={() => onMudarStatus(r.id, "REJEITADO")}
                    disabled={isActing}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      background: "rgba(107,114,128,0.08)", border: "1px solid rgba(107,114,128,0.2)",
                      color: "#6b7280", transition: "all 0.15s",
                    }}
                  >
                    <X size={14} /> Rejeitar
                  </button>
                  <div style={{ height: 1, background: "rgba(79,140,255,0.07)", margin: "2px 0" }} />
                  <button
                    onClick={() => onDeletar(r.id)}
                    disabled={isDeleting}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      padding: "8px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                      background: "none", border: "1px solid rgba(239,68,68,0.15)", color: "#4a617f",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.color = "#f87171"; b.style.borderColor = "rgba(239,68,68,0.35)"; }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.color = "#4a617f"; b.style.borderColor = "rgba(239,68,68,0.15)"; }}
                  >
                    {isDeleting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
                    Excluir rascunho
                  </button>
                </div>
              )}

              {/* Ações — APROVADO */}
              {r.status === "APROVADO" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 10, padding: "10px 14px",
                  }}>
                    <Check size={14} style={{ color: "#22C55E", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#22C55E", fontWeight: 600 }}>Post aprovado</span>
                  </div>
                  <div style={{
                    fontSize: 12, color: "#5d7899",
                    background: "rgba(124,92,255,0.05)", border: "1px solid rgba(124,92,255,0.12)",
                    borderRadius: 10, padding: "10px 14px", lineHeight: 1.5,
                  }}>
                    Publicação direta no Instagram em breve — por enquanto, copie a legenda e publique os slides manualmente.
                  </div>
                  <button
                    onClick={() => onMudarStatus(r.id, "RASCUNHO")}
                    style={{ fontSize: 11, color: "#4a617f", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textAlign: "left" }}
                  >
                    Desfazer aprovação
                  </button>
                  <button
                    onClick={() => onDeletar(r.id)}
                    disabled={isDeleting}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      padding: "7px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                      background: "none", border: "1px solid rgba(239,68,68,0.12)", color: "#4a617f",
                    }}
                  >
                    {isDeleting ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} />}
                    Excluir
                  </button>
                </div>
              )}

              {/* Ações — REJEITADO */}
              {r.status === "REJEITADO" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                  <button
                    onClick={() => onMudarStatus(r.id, "RASCUNHO")}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px", fontSize: 13 }}
                  >
                    Restaurar para revisão
                  </button>
                  <button
                    onClick={() => onDeletar(r.id)}
                    disabled={isDeleting}
                    style={{ fontSize: 11, color: "#4a617f", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Excluir definitivamente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Página principal ── */
export default function AutoPostsPage() {
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerandoLoading, setGerandoLoading] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);
  const [showTopicInput, setShowTopicInput] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [slideIdxMap, setSlideIdxMap] = useState<Record<string, number>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/autoposts/rascunhos");
    if (res.ok) setRascunhos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function gerar() {
    setGerandoLoading(true);
    setErroGerar(null);
    const res = await fetch("/api/autoposts/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topico: topicInput.trim() || undefined }),
    });
    setGerandoLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErroGerar((d as { error?: string }).error ?? "Erro ao gerar. Tente novamente.");
      return;
    }
    const novo: Rascunho = await res.json();
    setRascunhos(prev => [novo, ...prev]);
    setExpandedId(novo.id);
    setTopicInput("");
    setShowTopicInput(false);
  }

  async function mudarStatus(id: string, status: string) {
    setActionId(id);
    const res = await fetch(`/api/autoposts/rascunhos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActionId(null);
    if (res.ok) {
      const updated: Rascunho = await res.json();
      setRascunhos(prev => prev.map(r => r.id === id ? updated : r));
    }
  }

  async function deletar(id: string) {
    setActionId(id + "_del");
    await fetch(`/api/autoposts/rascunhos/${id}`, { method: "DELETE" });
    setActionId(null);
    setRascunhos(prev => prev.filter(r => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function getSlideIdx(id: string) { return slideIdxMap[id] ?? 0; }

  function prevSlide(id: string) {
    setSlideIdxMap(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  function nextSlide(id: string, total: number) {
    setSlideIdxMap(prev => ({ ...prev, [id]: Math.min(total - 1, (prev[id] ?? 0) + 1) }));
  }

  const pendentes  = rascunhos.filter(r => r.status === "RASCUNHO");
  const historico  = rascunhos.filter(r => r.status !== "RASCUNHO");

  return (
    <div style={{ padding: "24px 28px", maxWidth: 920 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5ff", margin: 0 }}>Auto Posts</h1>
          <p style={{ color: "#4a617f", fontSize: 13, marginTop: 4 }}>
            Carrosseis sobre IA gerados pela IA — você aprova antes de publicar.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <button
            className="btn-primary"
            onClick={() => { setShowTopicInput(v => !v); setErroGerar(null); }}
            disabled={gerandoLoading}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px" }}
          >
            {gerandoLoading
              ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              : <Wand2 size={14} />}
            {gerandoLoading ? "Gerando…" : "Gerar carrossel"}
          </button>

          {showTopicInput && !gerandoLoading && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Tema específico (opcional)"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && gerar()}
                autoFocus
                style={{ width: 230, fontSize: 13 }}
              />
              <button
                className="btn-primary"
                onClick={gerar}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 14px", fontSize: 13 }}
              >
                <Plus size={13} /> Gerar
              </button>
            </div>
          )}
        </div>
      </div>

      {erroGerar && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)",
          borderRadius: 10, padding: "10px 14px", marginBottom: 16,
          color: "#f87171", fontSize: 13,
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {erroGerar}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} style={{ color: "#4F8CFF", animation: "spin 1s linear infinite" }} />
        </div>
      ) : rascunhos.length === 0 ? (
        <div className="card" style={{ padding: "52px", textAlign: "center", color: "#4a617f" }}>
          <Wand2 size={36} style={{ color: "#4F8CFF", margin: "0 auto 14px", display: "block", opacity: 0.4 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#e8f0ff", marginBottom: 6 }}>
            Nenhum carrossel gerado ainda
          </p>
          <p style={{ fontSize: 13 }}>
            Clique em "Gerar carrossel" e a IA cria 5 slides sobre IA para você aprovar.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {pendentes.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#4a617f", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Aguardando aprovação ({pendentes.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendentes.map(r => {
                  const slides: Slide[] = (() => { try { return JSON.parse(r.slides); } catch { return []; } })();
                  return (
                    <RascunhoCard
                      key={r.id}
                      r={r}
                      expanded={expandedId === r.id}
                      slideIdx={getSlideIdx(r.id)}
                      onToggle={() => setExpandedId(prev => prev === r.id ? null : r.id)}
                      onPrevSlide={() => prevSlide(r.id)}
                      onNextSlide={() => nextSlide(r.id, slides.length)}
                      onMudarStatus={mudarStatus}
                      onDeletar={deletar}
                      actionId={actionId}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {historico.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#4a617f", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Histórico ({historico.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {historico.map(r => {
                  const slides: Slide[] = (() => { try { return JSON.parse(r.slides); } catch { return []; } })();
                  return (
                    <RascunhoCard
                      key={r.id}
                      r={r}
                      expanded={expandedId === r.id}
                      slideIdx={getSlideIdx(r.id)}
                      onToggle={() => setExpandedId(prev => prev === r.id ? null : r.id)}
                      onPrevSlide={() => prevSlide(r.id)}
                      onNextSlide={() => nextSlide(r.id, slides.length)}
                      onMudarStatus={mudarStatus}
                      onDeletar={deletar}
                      actionId={actionId}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
