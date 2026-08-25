"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, Trash2, Pencil, AlertTriangle, ChevronRight, CheckCircle, BarChart2 } from "lucide-react";
import { fmtBRL, parseBRL } from "@/lib/financeiro";
import { isAtrasado, ESTAGIOS_ATIVOS, calcResumoPipeline, labelMotivoPerda, type ResumoPipeline } from "@/lib/pipeline";
import type { LeadPipeline, PipelineOverview } from "@/app/api/pipeline/overview/route";
import { ContextoCard, ModalPerda, ResumoComercial, ZonasFinalizacao } from "@/components/pipeline/blocos";

// O formato vem da rota que já monta o contexto comercial de cada oportunidade.
type Lead = LeadPipeline;

const RESULTADOS = ["FECHADO", "PERDIDO"];

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
  nome: string; contato: string; origem: string; linhaInteresse: string; clienteId: string;
  estagio: string; valorStr: string; proximaAcao: string; proximaAcaoEm: string; notas: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  nome: "", contato: "", origem: "INSTAGRAM_DM", linhaInteresse: "INNOBI", clienteId: "",
  estagio: "LEAD", valorStr: "", proximaAcao: "", proximaAcaoEm: "", notas: "",
};

/**
 * O que o fechamento pergunta.
 *
 * Setup e mensalidade são campos separados porque um negócio recorrente costuma
 * ter os dois — implantação à vista mais assinatura — e cada um vira uma receita
 * com natureza própria: só a mensalidade entra no MRR.
 */
type ClosingState = {
  lead: Lead;
  form: {
    descricao: string;
    linha: string;
    competencia: string;
    setupStr: string;
    mensalidadeStr: string;
  };
} | null;

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroLinha, setFiltroLinha] = useState<string | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // DnD
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [zonaAtiva, setZonaAtiva] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoPipeline>(calcResumoPipeline([]));
  const [finalizadosAbertos, setFinalizadosAbertos] = useState(false);
  const [perdendo, setPerdendo] = useState<Lead | null>(null);
  const [perdendoSalvando, setPerdendoSalvando] = useState(false);

  // Fechamento
  const [closingState, setClosingState] = useState<ClosingState>(null);
  const [closingSaving, setClosingSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Atribuição
  const [atribuicaoOpen, setAtribuicaoOpen] = useState(false);
  type AtribuicaoItem = { postOrigemId: string; total: number; fechados: number; perdidos: number };
  const [atribuicao, setAtribuicao] = useState<AtribuicaoItem[]>([]);
  const [atribuicaoLoading, setAtribuicaoLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pipeline/overview");
    if (res.ok) {
      const data: PipelineOverview = await res.json();
      setLeads(data.leads);
      setResumo(data.resumo);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.ok ? r.json() : [])
      .then((lista: { id: string; name: string }[]) => {
        setClientes(lista);
        // Veio do perfil 360° por "+ Nova ação -> Nova oportunidade".
        const alvo = new URLSearchParams(window.location.search).get("cliente");
        if (alvo && lista.some(c => c.id === alvo)) {
          setForm(f => ({ ...f, clienteId: alvo }));
        }
      })
      .catch(() => {});
  }, []);

  const currentMes = new Date().toISOString().slice(0, 7);

  async function toggleAtribuicao() {
    if (!atribuicaoOpen && atribuicao.length === 0) {
      setAtribuicaoLoading(true);
      const res = await fetch("/api/leads/atribuicao");
      if (res.ok) setAtribuicao(await res.json());
      setAtribuicaoLoading(false);
    }
    setAtribuicaoOpen(v => !v);
  }


  // Aberto pelo "+ Novo" do painel: /negocio/... ?novo=1 já cai no formulário.
  // Tem de ser efeito: ler a URL durante o render divergiria do HTML do servidor
  // e quebraria a hidratação.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abertura única no mount, vinda da URL
    setDrawerOpen(true);
  }, []);

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
      clienteId: lead.clienteId ?? "",
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
      clienteId: form.clienteId || null,
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

    if (targetStage === "PERDIDO") {
      setPerdendo(lead);
      return;
    }

    if (targetStage === "FECHADO") {
      const estimado = lead.valorEstimadoCentavos != null
        ? (lead.valorEstimadoCentavos / 100).toFixed(2).replace(".", ",")
        : "";
      setClosingState({
        lead,
        form: {
          descricao: lead.nome,
          linha: lead.linhaInteresse,
          competencia: currentMes,
          setupStr: "",
          // O valor estimado vira a mensalidade proposta; quem fechou à vista
          // move o número para o setup em um campo.
          mensalidadeStr: estimado,
        },
      });
      return;
    }

    moveLead(leadId, targetStage);
  }

  async function handlePerder(motivo: string | null, nota: string) {
    if (!perdendo) return;
    setPerdendoSalvando(true);

    const id = perdendo.id;
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, estagio: "PERDIDO" } : l)));

    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estagio: "PERDIDO", motivoPerda: motivo, notaPerda: nota || null }),
    });

    setPerdendoSalvando(false);
    setPerdendo(null);
    // Recarrega sempre: o servidor devolve estagioDesde e o resumo recalculado.
    fetchLeads();
    if (!res.ok) console.error("[pipeline] falha ao marcar como perdido");
  }

  /**
   * Fecha o negócio numa chamada só.
   *
   * Toda a escrita mora no servidor (/api/leads/[id]/fechar): oportunidade e
   * receitas mudam na mesma transação, e o vínculo leadId impede que fechar duas
   * vezes gere duas receitas. O Pipeline não monta mais receita por conta própria.
   */
  async function fecharNegocio(comReceita: boolean) {
    if (!closingState) return;
    setClosingSaving(true);

    const { form, lead } = closingState;
    const setup = parseBRL(form.setupStr);
    const mensalidade = parseBRL(form.mensalidadeStr);
    const base = { linha: form.linha, competencia: form.competencia };
    const nome = form.descricao.trim() || lead.nome;

    const corpo = comReceita
      ? {
          pontual:
            setup > 0 ? { ...base, descricao: `${nome} — setup`, valorCentavos: setup } : null,
          recorrente:
            mensalidade > 0 ? { ...base, descricao: nome, valorCentavos: mensalidade } : null,
        }
      : {};

    const res = await fetch(`/api/leads/${lead.id}/fechar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

    setClosingSaving(false);
    if (res.ok) {
      setClosingState(null);
      fetchLeads();
    }
  }

  const visibleLeads = filtroLinha
    ? leads.filter(l => l.linhaInteresse === filtroLinha)
    : leads;

  const finalizados = {
    fechados: visibleLeads.filter(l => l.estagio === "FECHADO"),
    perdidos: visibleLeads.filter(l => l.estagio === "PERDIDO"),
  };

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

      {/* ── Atribuição IG ── */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={toggleAtribuicao}
          style={{
            display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
            cursor: "pointer", color: atribuicaoOpen ? "#4F8CFF" : "#4a617f", fontSize: 12,
            fontWeight: 600, padding: "4px 0", transition: "color 0.15s",
          }}
        >
          <BarChart2 size={13} />
          Leads por post do Instagram
          <ChevronRight size={12} style={{ transform: atribuicaoOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
          {atribuicaoLoading && <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />}
        </button>

        {atribuicaoOpen && (
          <div style={{ marginTop: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(79,140,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
            {atribuicao.length === 0 ? (
              <p style={{ padding: "16px 20px", fontSize: 12, color: "#4a617f" }}>
                Nenhum lead com origem em posts do Instagram. Ative "Gerar lead no pipeline" numa automação.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {["Post (ID)", "Leads", "Fechados", "Taxa"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#4a617f", letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {atribuicao.map((item, i) => {
                    const taxa = item.total > 0 ? Math.round((item.fechados / item.total) * 100) : 0;
                    return (
                      <tr
                        key={item.postOrigemId}
                        style={{ borderBottom: i < atribuicao.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
                      >
                        <td style={{ padding: "10px 16px", fontSize: 11, color: "#6b82a8", fontFamily: "monospace" }}>
                          {item.postOrigemId.slice(0, 20)}…
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#4F8CFF" }}>{item.total}</td>
                        <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#22C55E" }}>{item.fechados}</td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: taxa > 20 ? "#22C55E" : "#6b82a8" }}>
                          {taxa}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Resumo comercial ── */}
      {!loading && <ResumoComercial resumo={resumo} />}

      {/* ── Zonas de resultado: só durante o arraste ── */}
      <ZonasFinalizacao
        visivel={arrastando}
        zonaAtiva={zonaAtiva}
        onZona={setZonaAtiva}
        onSoltar={(zona, leadId) => {
          setArrastando(false);
          handleDrop(leadId, zona);
        }}
      />

      {/* ── Kanban ── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <Loader2 size={24} style={{ color: "#4F8CFF", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", flex: 1, paddingBottom: 8 }}>
          {ESTAGIOS.filter(e => !RESULTADOS.includes(e.key)).map(stage => {
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
                    <span style={{ fontSize: 11, color: "#6b81a8", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "1px 7px" }}>
                      {stageLeads.length}
                    </span>
                    <span style={{ fontSize: 11, color: "#6b81a8", fontVariantNumeric: "tabular-nums" }}>
                      {fmtBRL(stageLeads.reduce((soma, l) => soma + (l.valorEstimadoCentavos ?? 0), 0))}
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

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData("leadId", lead.id);
                          e.dataTransfer.effectAllowed = "move";
                          setArrastando(true);
                        }}
                        onDragEnd={() => { setArrastando(false); setZonaAtiva(null); }}
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

                        {/* Quem: o cliente vinculado, quando existe */}
                        {lead.clienteNome && (
                          <a
                            href={`/negocio/clientes/${lead.clienteId}`}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 11, color: "#6b81a8", textDecoration: "none", display: "block", marginTop: 3 }}
                          >
                            {lead.clienteNome} →
                          </a>
                        )}

                        <ContextoCard lead={lead} corLinha={linha?.color} />
                      </div>
                    );
                  })}

                  {stageLeads.length === 0 && visibleLeads.length > 0 && (
                    <div style={{ textAlign: "center", padding: "14px 0", color: "#2a3a52", fontSize: 11 }}>
                      Arraste um card aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Finalizados: resultado, não trabalho em andamento ── */}
      {!loading && (finalizados.fechados.length > 0 || finalizados.perdidos.length > 0) && (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
          <button
            onClick={() => setFinalizadosAbertos(v => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--foreground-2)" }}>Finalizados</span>
            <span style={{ color: "#22C55E" }}>Fechados {finalizados.fechados.length}</span>
            <span style={{ color: "#EF4444" }}>Perdidos {finalizados.perdidos.length}</span>
            <span style={{ color: "var(--muted-2)" }}>{finalizadosAbertos ? "▾" : "▸"}</span>
          </button>

          {finalizadosAbertos && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, maxHeight: 150, overflowY: "auto" }}>
              {[...finalizados.fechados, ...finalizados.perdidos].map(lead => {
                const ganho = lead.estagio === "FECHADO";
                const motivo = labelMotivoPerda(lead.motivoPerda);
                return (
                  <div
                    key={lead.id}
                    onClick={() => openEdit(lead)}
                    style={{
                      cursor: "pointer", borderRadius: 10, padding: "7px 11px",
                      border: "1px solid var(--border-subtle)",
                      borderLeft: `3px solid ${ganho ? "#22C55E" : "#EF4444"}`,
                      background: "rgba(255,255,255,0.015)", minWidth: 190,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, color: "var(--foreground-2)" }}>{lead.nome}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted-2)" }}>
                      {lead.valorEstimadoCentavos ? fmtBRL(lead.valorEstimadoCentavos) : "sem valor"}
                      {motivo && ` · ${motivo}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {perdendo && (
        <ModalPerda
          nome={perdendo.nome}
          salvando={perdendoSalvando}
          onCancelar={() => setPerdendo(null)}
          onConfirmar={handlePerder}
        />
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

              <Field label="Cliente">
                <select
                  className="input"
                  value={form.clienteId}
                  onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                >
                  <option value="">Sem vínculo</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

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

            {closingState.lead.receitasGeradas > 0 ? (
              <p style={{ fontSize: 12, color: "#fbbf24", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 16, lineHeight: 1.5 }}>
                Esta oportunidade já gerou {closingState.lead.receitasGeradas === 1 ? "uma receita" : `${closingState.lead.receitasGeradas} receitas`} no Financeiro.
                Fechar de novo não cria outra.
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "#6b82a8", marginBottom: 16 }}>
                O que foi contratado? Vira receita no Financeiro, já vinculada a esta oportunidade
                {closingState.lead.clienteNome ? ` e a ${closingState.lead.clienteNome}` : ""}.
              </p>
            )}

            {closingState.lead.receitasGeradas === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Entrada / setup (R$)">
                    <input
                      className="input"
                      placeholder="opcional"
                      inputMode="decimal"
                      value={closingState.form.setupStr}
                      onChange={e => setClosingState(s => s ? { ...s, form: { ...s.form, setupStr: e.target.value } } : null)}
                    />
                  </Field>
                  <Field label="Mensalidade (R$)">
                    <input
                      className="input"
                      placeholder="opcional"
                      inputMode="decimal"
                      value={closingState.form.mensalidadeStr}
                      onChange={e => setClosingState(s => s ? { ...s, form: { ...s.form, mensalidadeStr: e.target.value } } : null)}
                    />
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
                <p style={{ fontSize: 11, color: "#4a617f", lineHeight: 1.5, margin: 0 }}>
                  Só a mensalidade entra no MRR. O setup vira uma receita pontual separada.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setClosingState(null)}
                disabled={closingSaving}
                style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#6b82a8", borderRadius: 10, padding: "9px 0", cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => fecharNegocio(false)}
                disabled={closingSaving}
                style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#c8d4f0", borderRadius: 10, padding: "9px 0", cursor: "pointer", fontSize: 13 }}
              >
                Só fechar
              </button>
              {closingState.lead.receitasGeradas === 0 && (
                <button
                  className="btn-primary"
                  onClick={() => fecharNegocio(true)}
                  disabled={closingSaving}
                  style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
                >
                  {closingSaving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={14} />}
                  Criar receita e fechar
                </button>
              )}
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
