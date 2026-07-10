"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, Trash2, Pencil, AlertTriangle, ChevronRight, CheckCircle } from "lucide-react";
import { fmtBRL, parseBRL } from "@/lib/financeiro";
import { isAtrasado, ESTAGIOS_ATIVOS } from "@/lib/pipeline";

interface Lead {
  id: string;
  nome: string;
  contato: string;
  estagio: string;
  origem: string;
  linhaInteresse: string;
  valorEstimadoCentavos: number | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  notas: string | null;
  criadoEm: string;
}

const ESTAGIOS = [
  { key: "LEAD",             label: "Lead",       color: "#4F8CFF", bg: "rgba(79,140,255,0.06)",  border: "rgba(79,140,255,0.18)"  },
  { key: "QUALIFICADO",      label: "Qualificado", color: "#7C5CFF", bg: "rgba(124,92,255,0.06)", border: "rgba(124,92,255,0.18)"  },
  { key: "PROPOSTA_ENVIADA", label: "Proposta",    color: "#F59E0B", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)"  },
  { key: "NEGOCIACAO",       label: "Negociação",  color: "#F97316", bg: "rgba(249,115,22,0.06)", border: "rgba(249,115,22,0.18)"  },
  { key: "FECHADO",          label: "Fechado",     color: "#22C55E", bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.18)"   },
  { key: "PERDIDO",          label: "Perdido",     color: "#EF4444", bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.18)"   },
];

const ORIGENS = [
  { key: "INSTAGRAM_DM",          label: "Instagram DM" },
  { key: "INSTAGRAM_COMENTARIO",  label: "Instagram Comentário" },
  { key: "WHATSAPP",              label: "WhatsApp" },
  { key: "EMAIL",                 label: "E-mail" },
  { key: "INDICACAO",             label: "Indicação" },
  { key: "OUTRO",                 label: "Outro" },
];

const LINHAS = [
  { key: "INNOBI",   label: "Innobi",   color: "#4F8CFF" },
  { key: "MENTORIA", label: "Mentoria", color: "#7C5CFF" },
  { key: "SERVICOS", label: "Serviços", color: "#00D4FF" },
];

type FormState = {
  nome: string; contato: string; origem: string; linhaInteresse: string;
  estagio: string; valorStr: string; proximaAcao: string; proximaAcaoEm: string; notas: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  nome: "", contato: "", origem: "INSTAGRAM_DM", linhaInteresse: "INNOBI",
  estagio: "LEAD", valorStr: "", proximaAcao: "", proximaAcaoEm: "", notas: "",
};

type ClosingState = {
  lead: Lead;
  form: { descricao: string; valorStr: string; linha: string; tipo: string; competencia: string };
} | null;

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroLinha, setFiltroLinha] = useState<string | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // DnD
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Fechamento
  const [closingState, setClosingState] = useState<ClosingState>(null);
  const [closingSaving, setClosingSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/leads");
    if (res.ok) setLeads(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const currentMes = new Date().toISOString().slice(0, 7);

  function openAdd(initialStage = "LEAD") {
    setEditingLead(null);
    setForm({ ...EMPTY_FORM, estagio: initialStage });
    setErrors({});
    setDrawerOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead);
    setForm({
      nome: lead.nome,
      contato: lead.contato,
      origem: lead.origem,
      linhaInteresse: lead.linhaInteresse,
      estagio: lead.estagio,
      valorStr: lead.valorEstimadoCentavos != null
        ? (lead.valorEstimadoCentavos / 100).toFixed(2).replace(".", ",")
        : "",
      proximaAcao: lead.proximaAcao ?? "",
      proximaAcaoEm: lead.proximaAcaoEm
        ? new Date(lead.proximaAcaoEm).toLocaleDateString("sv", { timeZone: "UTC" })
        : "",
      notas: lead.notas ?? "",
    });
    setErrors({});
    setDrawerOpen(true);
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.nome.trim()) errs.nome = "Obrigatório";
    if (!form.contato.trim()) errs.contato = "Obrigatório";
    if (ESTAGIOS_ATIVOS.includes(form.estagio)) {
      if (!form.proximaAcao.trim()) errs.proximaAcao = "Obrigatório para leads ativos";
      if (!form.proximaAcaoEm) errs.proximaAcaoEm = "Obrigatório para leads ativos";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    const payload = {
      nome: form.nome.trim(),
      contato: form.contato.trim(),
      origem: form.origem,
      linhaInteresse: form.linhaInteresse,
      estagio: form.estagio,
      valorEstimadoCentavos: form.valorStr ? parseBRL(form.valorStr) : null,
      proximaAcao: form.proximaAcao.trim() || null,
      proximaAcaoEm: form.proximaAcaoEm ? new Date(form.proximaAcaoEm).toISOString() : null,
      notas: form.notas.trim() || null,
    };

    const url = editingLead ? `/api/leads/${editingLead.id}` : "/api/leads";
    const method = editingLead ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setDrawerOpen(false);
      fetchLeads();
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setLeads(prev => prev.filter(l => l.id !== id));
    if (drawerOpen && editingLead?.id === id) setDrawerOpen(false);
  }

  async function moveLead(leadId: string, targetStage: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, estagio: targetStage } : l));
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estagio: targetStage }),
    });
    if (!res.ok) fetchLeads();
  }

  function handleDrop(leadId: string, targetStage: string) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.estagio === targetStage) return;

    if (targetStage === "FECHADO") {
      setClosingState({
        lead,
        form: {
          descricao: lead.nome,
          valorStr: lead.valorEstimadoCentavos != null
            ? (lead.valorEstimadoCentavos / 100).toFixed(2).replace(".", ",")
            : "",
          linha: lead.linhaInteresse,
          tipo: "RECORRENTE",
          competencia: currentMes,
        },
      });
      return;
    }

    moveLead(leadId, targetStage);
  }

  async function handleFechadoComReceita() {
    if (!closingState) return;
    setClosingSaving(true);

    const centavos = parseBRL(closingState.form.valorStr);
    if (centavos > 0) {
      await fetch("/api/receitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: closingState.form.descricao || closingState.lead.nome,
          valorCentavos: centavos,
          linha: closingState.form.linha,
          tipo: closingState.form.tipo,
          status: "CONFIRMADA",
          competencia: closingState.form.competencia,
        }),
      });
    }

    await fetch(`/api/leads/${closingState.lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estagio: "FECHADO" }),
    });

    setClosingSaving(false);
    setClosingState(null);
    fetchLeads();
  }

  async function handleFechadoSemReceita() {
    if (!closingState) return;
    setClosingSaving(true);
    await fetch(`/api/leads/${closingState.lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estagio: "FECHADO" }),
    });
    setClosingSaving(false);
    setClosingState(null);
    fetchLeads();
  }

  const visibleLeads = filtroLinha
    ? leads.filter(l => l.linhaInteresse === filtroLinha)
    : leads;

  const totalAtivos = leads.filter(l => ESTAGIOS_ATIVOS.includes(l.estagio)).length;
  const totalAtrasados = leads.filter(
    l => ESTAGIOS_ATIVOS.includes(l.estagio) && isAtrasado(l.proximaAcaoEm)
  ).length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "24px 28px", gap: 20, overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5ff", margin: 0 }}>Pipeline</h1>
          <p style={{ color: "#4a617f", fontSize: 13, marginTop: 4 }}>
            Quem está esperando algo de mim agora?
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {totalAtrasados > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#f87171", fontWeight: 600 }}>
              <AlertTriangle size={13} />
              {totalAtrasados} atrasado{totalAtrasados > 1 ? "s" : ""}
            </span>
          )}
          <span style={{ color: "#4a617f", fontSize: 12 }}>{totalAtivos} leads ativos</span>
          <button
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px" }}
            onClick={() => openAdd()}
          >
            <Plus size={15} /> Novo lead
          </button>
        </div>
      </div>

      {/* ── Filtros por linha ── */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => setFiltroLinha(null)}
          style={{
            padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            background: filtroLinha === null ? "rgba(79,140,255,0.18)" : "transparent",
            border: `1px solid ${filtroLinha === null ? "rgba(79,140,255,0.4)" : "rgba(79,140,255,0.12)"}`,
            color: filtroLinha === null ? "#4F8CFF" : "#4a617f",
          }}
        >
          Todos
        </button>
        {LINHAS.map(l => (
          <button
            key={l.key}
            onClick={() => setFiltroLinha(filtroLinha === l.key ? null : l.key)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              background: filtroLinha === l.key ? `${l.color}22` : "transparent",
              border: `1px solid ${filtroLinha === l.key ? `${l.color}55` : "rgba(79,140,255,0.12)"}`,
              color: filtroLinha === l.key ? l.color : "#4a617f",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* ── Kanban ── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <Loader2 size={24} style={{ color: "#4F8CFF", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", flex: 1, paddingBottom: 8 }}>
          {ESTAGIOS.map(stage => {
            const stageLeads = visibleLeads.filter(l => l.estagio === stage.key);
            const isOver = dragOver === stage.key;

            return (
              <div
                key={stage.key}
                style={{
                  flex: "0 0 252px", minWidth: 252, display: "flex", flexDirection: "column", gap: 0,
                  background: isOver ? stage.bg : "rgba(255,255,255,0.015)",
                  border: `1px solid ${isOver ? stage.border : "rgba(255,255,255,0.04)"}`,
                  borderRadius: 16, padding: "0 0 8px", transition: "background 0.15s, border-color 0.15s",
                  overflowY: "auto",
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.key); }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(null);
                  handleDrop(e.dataTransfer.getData("leadId"), stage.key);
                }}
              >
                {/* Column header */}
                <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 1, borderRadius: "16px 16px 0 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, boxShadow: `0 0 6px ${stage.color}` }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: stage.color, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      {stage.label}
                    </span>
                    <span style={{ fontSize: 11, color: "#4a617f", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "1px 7px" }}>
                      {stageLeads.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openAdd(stage.key)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#4a617f", padding: 2, borderRadius: 6, display: "flex", transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = stage.color)}
                    onMouseLeave={e => (e.currentTarget.style.color = "#4a617f")}
                    title="Adicionar lead neste estágio"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 10px 0" }}>
                  {stageLeads.map(lead => {
                    const atrasado = ESTAGIOS_ATIVOS.includes(lead.estagio) && isAtrasado(lead.proximaAcaoEm);
                    const linha = LINHAS.find(l => l.key === lead.linhaInteresse);
                    const dateStr = fmtDate(lead.proximaAcaoEm);

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData("leadId", lead.id); e.dataTransfer.effectAllowed = "move"; }}
                        style={{
                          background: "var(--surface-2)",
                          border: `1px solid ${atrasado ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.05)"}`,
                          borderLeft: `3px solid ${atrasado ? "#EF4444" : stage.color}`,
                          borderRadius: 12,
                          padding: "12px 12px 10px",
                          cursor: "grab",
                          transition: "border-color 0.15s, transform 0.1s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
                        onMouseLeave={e => (e.currentTarget.style.transform = "")}
                      >
                        {/* Card header */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e8f0ff", lineHeight: 1.3 }}>{lead.nome}</span>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button
                              onClick={() => openEdit(lead)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#4a617f", padding: 2, borderRadius: 4, display: "flex" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#4F8CFF")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#4a617f")}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(lead.id)}
                              disabled={deletingId === lead.id}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#4a617f", padding: 2, borderRadius: 4, display: "flex" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#4a617f")}
                            >
                              {deletingId === lead.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        </div>

                        {/* Linha + valor */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: linha?.color, background: `${linha?.color}18`, borderRadius: 8, padding: "2px 7px", letterSpacing: "0.03em" }}>
                            {linha?.label}
                          </span>
                          {lead.valorEstimadoCentavos != null && lead.valorEstimadoCentavos > 0 && (
                            <span style={{ fontSize: 11, color: "#6b82a8" }}>
                              {fmtBRL(lead.valorEstimadoCentavos)}
                            </span>
                          )}
                        </div>

                        {/* Próxima ação */}
                        {lead.proximaAcao && (
                          <div style={{ marginTop: 8, display: "flex", alignItems: "flex-start", gap: 5 }}>
                            <ChevronRight size={11} style={{ color: atrasado ? "#f87171" : "#4a617f", marginTop: 2, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 11, color: "#c8d4f0", lineHeight: 1.4 }}>{lead.proximaAcao}</span>
                              {dateStr && (
                                <span style={{ display: "block", fontSize: 10, color: atrasado ? "#f87171" : "#4a617f", fontWeight: 600, marginTop: 2 }}>
                                  {atrasado ? "⚠ " : ""}{dateStr}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {stageLeads.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#2a3a52", fontSize: 12 }}>
                      Arraste um card aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drawer — Novo/Editar Lead ── */}
      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div
            style={{ flex: 1, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={() => setDrawerOpen(false)}
          />
          <div style={{
            width: 400, background: "var(--surface-1)", borderLeft: "1px solid rgba(79,140,255,0.12)",
            overflowY: "auto", display: "flex", flexDirection: "column",
          }}>
            {/* Drawer header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--surface-1)", zIndex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5ff", margin: 0 }}>
                {editingLead ? "Editar lead" : "Novo lead"}
              </h2>
              <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4a617f", padding: 4, borderRadius: 6 }}>
                <X size={18} />
              </button>
            </div>

            {/* Drawer form */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>

              <Field label="Nome *" error={errors.nome}>
                <input
                  className="input"
                  placeholder="Nome do lead"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                />
              </Field>

              <Field label="Contato *" error={errors.contato}>
                <input
                  className="input"
                  placeholder="@instagram, WhatsApp ou e-mail"
                  value={form.contato}
                  onChange={e => setForm(f => ({ ...f, contato: e.target.value }))}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Origem">
                  <select className="input" value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}>
                    {ORIGENS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Linha">
                  <select className="input" value={form.linhaInteresse} onChange={e => setForm(f => ({ ...f, linhaInteresse: e.target.value }))}>
                    {LINHAS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Estágio">
                  <select className="input" value={form.estagio} onChange={e => setForm(f => ({ ...f, estagio: e.target.value }))}>
                    {ESTAGIOS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Valor estimado">
                  <input
                    className="input"
                    placeholder="1.500,00"
                    value={form.valorStr}
                    onChange={e => setForm(f => ({ ...f, valorStr: e.target.value }))}
                  />
                </Field>
              </div>

              {ESTAGIOS_ATIVOS.includes(form.estagio) && (
                <div style={{ background: "rgba(79,140,255,0.06)", border: "1px solid rgba(79,140,255,0.15)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 11, color: "#4F8CFF", fontWeight: 700, margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Próxima ação obrigatória
                  </p>
                  <Field label="O que fazer?" error={errors.proximaAcao}>
                    <input
                      className="input"
                      placeholder="Ex: Ligar e apresentar proposta"
                      value={form.proximaAcao}
                      onChange={e => setForm(f => ({ ...f, proximaAcao: e.target.value }))}
                    />
                  </Field>
                  <Field label="Até quando?" error={errors.proximaAcaoEm}>
                    <input
                      className="input"
                      type="date"
                      value={form.proximaAcaoEm}
                      onChange={e => setForm(f => ({ ...f, proximaAcaoEm: e.target.value }))}
                    />
                  </Field>
                </div>
              )}

              <Field label="Notas">
                <textarea
                  className="input"
                  placeholder="Observações sobre o lead..."
                  rows={3}
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  style={{ resize: "vertical" }}
                />
              </Field>

            </div>

            {/* Drawer footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 10, position: "sticky", bottom: 0, background: "var(--surface-1)" }}>
              {editingLead && (
                <button
                  onClick={() => handleDelete(editingLead.id)}
                  disabled={deletingId === editingLead.id}
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#6b82a8", borderRadius: 10, padding: "8px 0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}
              >
                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={14} />}
                {editingLead ? "Salvar" : "Criar lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal — Fechar Lead ── */}
      {closingState && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={() => !closingSaving && setClosingState(null)} />
          <div style={{ position: "relative", width: 440, background: "var(--surface-1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "28px 28px 24px", boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🎉</span>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5ff", margin: 0 }}>Lead fechado!</h3>
                <p style={{ fontSize: 12, color: "#4a617f", margin: "4px 0 0" }}>{closingState.lead.nome}</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#6b82a8", marginBottom: 16 }}>Criar uma receita vinculada ao fechamento?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Valor (R$)">
                  <input
                    className="input"
                    placeholder="1.500,00"
                    value={closingState.form.valorStr}
                    onChange={e => setClosingState(s => s ? { ...s, form: { ...s.form, valorStr: e.target.value } } : null)}
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    className="input"
                    value={closingState.form.tipo}
                    onChange={e => setClosingState(s => s ? { ...s, form: { ...s.form, tipo: e.target.value } } : null)}
                  >
                    <option value="RECORRENTE">Recorrente</option>
                    <option value="PONTUAL">Pontual</option>
                  </select>
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Linha">
                  <select
                    className="input"
                    value={closingState.form.linha}
                    onChange={e => setClosingState(s => s ? { ...s, form: { ...s.form, linha: e.target.value } } : null)}
                  >
                    {LINHAS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </select>
                </Field>
                <Field label="Competência">
                  <input
                    className="input"
                    type="month"
                    value={closingState.form.competencia}
                    onChange={e => setClosingState(s => s ? { ...s, form: { ...s.form, competencia: e.target.value } } : null)}
                  />
                </Field>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setClosingState(null)}
                disabled={closingSaving}
                style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#6b82a8", borderRadius: 10, padding: "9px 0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleFechadoSemReceita}
                disabled={closingSaving}
                style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#c8d4f0", borderRadius: 10, padding: "9px 0", cursor: "pointer", fontSize: 13 }}
              >
                Só fechar
              </button>
              <button
                className="btn-primary"
                onClick={handleFechadoComReceita}
                disabled={closingSaving}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
              >
                {closingSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={14} />}
                Criar receita e fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#4a617f", letterSpacing: "0.03em" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: "#f87171" }}>{error}</span>}
    </div>
  );
}
