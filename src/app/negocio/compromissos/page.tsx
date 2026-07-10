"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, Trash2, Check, AlertTriangle, X } from "lucide-react";
import { isVencido, fmtPrazo, diasParaVencer } from "@/lib/compromisso";

interface Compromisso {
  id: string;
  descricao: string;
  para: string;
  prazoEm: string;
  cumprido: boolean;
  cumpridoEm: string | null;
  notas: string | null;
  criadoEm: string;
}

type Filtro = "PENDENTES" | "ATRASADOS" | "CUMPRIDOS";

const EMPTY_FORM = { descricao: "", para: "", prazoEm: "", notas: "" };

export default function CompromissosPage() {
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("PENDENTES");

  // Quick-add
  const [form, setForm] = useState(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState<Partial<typeof EMPTY_FORM>>({});
  const [adicionando, setAdicionando] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Inline actions
  const [cumpridoId, setCumpridoId] = useState<string | null>(null);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/compromissos");
    if (res.ok) setCompromissos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function validate(): boolean {
    const errs: Partial<typeof EMPTY_FORM> = {};
    if (!form.descricao.trim()) errs.descricao = "Obrigatório";
    if (!form.para.trim()) errs.para = "Obrigatório";
    if (!form.prazoEm) errs.prazoEm = "Obrigatório";
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setAdicionando(true);
    const res = await fetch("/api/compromissos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: form.descricao.trim(),
        para: form.para.trim(),
        prazoEm: new Date(form.prazoEm).toISOString(),
        notas: form.notas.trim() || null,
      }),
    });
    setAdicionando(false);
    if (res.ok) {
      setForm(EMPTY_FORM);
      setAddErrors({});
      setAddOpen(false);
      fetch_();
    }
  }

  async function marcarCumprido(id: string, cumprido: boolean) {
    setCumpridoId(id);
    await fetch(`/api/compromissos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cumprido }),
    });
    setCumpridoId(null);
    fetch_();
  }

  async function deletar(id: string) {
    setDeletandoId(id);
    await fetch(`/api/compromissos/${id}`, { method: "DELETE" });
    setDeletandoId(null);
    setCompromissos(prev => prev.filter(c => c.id !== id));
  }

  const hoje = new Date();
  const inicioDia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const fimDia = new Date(inicioDia.getTime() + 86_400_000);

  const pendentes = compromissos.filter(c => !c.cumprido);
  const atrasados = pendentes.filter(c => isVencido(c.prazoEm, false));
  const hoje_ = pendentes.filter(c => {
    const p = new Date(c.prazoEm);
    return p >= inicioDia && p < fimDia;
  });
  const cumpridos = compromissos.filter(c => c.cumprido);

  const visivel = (() => {
    if (filtro === "PENDENTES") return pendentes;
    if (filtro === "ATRASADOS") return atrasados;
    return cumpridos;
  })();

  const FILTROS: { key: Filtro; label: string; count: number }[] = [
    { key: "PENDENTES", label: "Pendentes",  count: pendentes.length  },
    { key: "ATRASADOS", label: "Atrasados",  count: atrasados.length  },
    { key: "CUMPRIDOS", label: "Cumpridos",  count: cumpridos.length  },
  ];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 760 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5ff", margin: 0 }}>Compromissos</h1>
          <p style={{ color: "#4a617f", fontSize: 13, marginTop: 4 }}>
            Promessas feitas a terceiros — mais sérias que tarefas internas.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setAddOpen(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px" }}
        >
          {addOpen ? <X size={14} /> : <Plus size={14} />}
          {addOpen ? "Cancelar" : "Novo compromisso"}
        </button>
      </div>

      {/* ── Stats rápidas ── */}
      {!loading && (atrasados.length > 0 || hoje_.length > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {atrasados.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, padding: "5px 12px" }}>
              <AlertTriangle size={12} style={{ color: "#f87171" }} />
              <span style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>
                {atrasados.length} atrasado{atrasados.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
          {hoje_.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 20, padding: "5px 12px" }}>
              <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>
                {hoje_.length} vence{hoje_.length > 1 ? "m" : ""} hoje
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Formulário de adição ── */}
      {addOpen && (
        <form
          onSubmit={handleAdd}
          className="card"
          style={{ padding: "18px 20px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#4a617f", display: "block", marginBottom: 5 }}>
                Compromisso *
              </label>
              <input
                className="input"
                placeholder="Enviar proposta revisada até sexta"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                autoFocus
              />
              {addErrors.descricao && <span style={{ fontSize: 11, color: "#f87171" }}>{addErrors.descricao}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#4a617f", display: "block", marginBottom: 5 }}>
                Para quem *
              </label>
              <input
                className="input"
                placeholder="João / @cliente"
                value={form.para}
                onChange={e => setForm(f => ({ ...f, para: e.target.value }))}
              />
              {addErrors.para && <span style={{ fontSize: 11, color: "#f87171" }}>{addErrors.para}</span>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 12, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#4a617f", display: "block", marginBottom: 5 }}>
                Prazo *
              </label>
              <input
                className="input"
                type="date"
                value={form.prazoEm}
                onChange={e => setForm(f => ({ ...f, prazoEm: e.target.value }))}
              />
              {addErrors.prazoEm && <span style={{ fontSize: 11, color: "#f87171" }}>{addErrors.prazoEm}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#4a617f", display: "block", marginBottom: 5 }}>
                Nota (opcional)
              </label>
              <input
                className="input"
                placeholder="Contexto adicional..."
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={adicionando}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 18px", whiteSpace: "nowrap" }}
            >
              {adicionando ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
              Adicionar
            </button>
          </div>
        </form>
      )}

      {/* ── Filtros ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              background: filtro === f.key ? "rgba(79,140,255,0.18)" : "transparent",
              border: `1px solid ${filtro === f.key ? "rgba(79,140,255,0.4)" : "rgba(79,140,255,0.12)"}`,
              color: filtro === f.key ? "#4F8CFF" : "#4a617f",
            }}
          >
            {f.label}
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{f.count}</span>
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
          <Check size={28} style={{ color: "#22C55E", margin: "0 auto 12px", display: "block" }} />
          <p style={{ fontSize: 14 }}>
            {filtro === "PENDENTES" ? "Nenhum compromisso pendente. Ótimo!" :
             filtro === "ATRASADOS" ? "Nenhum compromisso atrasado." :
             "Nenhum compromisso cumprido ainda."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visivel.map(c => {
            const vencido = isVencido(c.prazoEm, c.cumprido);
            const dias = diasParaVencer(c.prazoEm);
            const prazoLabel = fmtPrazo(c.prazoEm);
            const isCumprindo = cumpridoId === c.id;
            const isDeletando = deletandoId === c.id;

            let corBorda = "rgba(79,140,255,0.2)";
            let corPrazo = "#4a617f";
            if (c.cumprido) { corBorda = "rgba(34,197,94,0.2)"; corPrazo = "#22C55E"; }
            else if (vencido) { corBorda = "rgba(239,68,68,0.4)"; corPrazo = "#f87171"; }
            else if (dias === 0 || dias === 1) { corBorda = "rgba(245,158,11,0.35)"; corPrazo = "#fbbf24"; }

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  borderLeft: `3px solid ${corBorda}`,
                  opacity: c.cumprido ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {/* Checkbox cumprido */}
                <button
                  onClick={() => marcarCumprido(c.id, !c.cumprido)}
                  disabled={isCumprindo}
                  title={c.cumprido ? "Marcar como pendente" : "Marcar como cumprido"}
                  style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${c.cumprido ? "#22C55E" : "rgba(79,140,255,0.3)"}`,
                    background: c.cumprido ? "rgba(34,197,94,0.15)" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {isCumprindo
                    ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite", color: "#4F8CFF" }} />
                    : c.cumprido
                    ? <Check size={12} style={{ color: "#22C55E" }} />
                    : null}
                </button>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: c.cumprido ? "#4a617f" : "#e8f0ff",
                    textDecoration: c.cumprido ? "line-through" : "none",
                  }}>
                    {c.descricao}
                  </span>
                  <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#4a617f" }}>
                      para <span style={{ color: "#6b82a8", fontWeight: 600 }}>{c.para}</span>
                    </span>
                    {c.notas && (
                      <span style={{ fontSize: 11, color: "#4a617f", fontStyle: "italic" }}>
                        — {c.notas}
                      </span>
                    )}
                  </div>
                </div>

                {/* Prazo */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
                  {vencido && (
                    <AlertTriangle size={11} style={{ color: "#f87171", marginBottom: 2, display: "inline-block", marginRight: 3 }} />
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, color: corPrazo }}>
                    {c.cumprido && c.cumpridoEm ? `✓ ${new Date(c.cumpridoEm).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" })}` : prazoLabel}
                  </span>
                </div>

                {/* Ações */}
                <button
                  onClick={() => deletar(c.id)}
                  disabled={isDeletando}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#2a3a52", padding: 4, borderRadius: 6, flexShrink: 0, display: "flex", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#2a3a52")}
                >
                  {isDeletando ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
