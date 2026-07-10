"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign, TrendingUp, Clock, BarChart3,
  Plus, X, Check, Pencil, Trash2, Loader2, ChevronDown,
} from "lucide-react";
import { MrrStackedBarChart, type MrrHistoricoItem } from "@/components/charts";
import { fmtBRL, parseBRL } from "@/lib/financeiro";

// ─── Types ───────────────────────────────────────────────────────────────────

type Resumo = {
  mes: string;
  mrrAtual: number;
  mrrVariacao: number | null;
  receitaPontual: number;
  aReceber: number;
  runway: number | null;
  saldoCaixa: number;
};

type Receita = {
  id: string;
  descricao: string;
  valorCentavos: number;
  linha: string;
  tipo: string;
  status: string;
  competencia: string;
  dataRecebida: string | null;
  clienteId: string | null;
  cliente: { id: string; name: string } | null;
};

type Client = { id: string; name: string };

const LINHAS  = ["INNOBI", "MENTORIA", "SERVICOS"] as const;
const TIPOS   = ["RECORRENTE", "PONTUAL"] as const;
const STATUSES = ["PREVISTA", "CONFIRMADA", "RECEBIDA", "INADIMPLENTE"] as const;

const LINHA_LABELS:  Record<string, string> = { INNOBI: "Innobi", MENTORIA: "Mentoria", SERVICOS: "Serviços" };
const TIPO_LABELS:   Record<string, string> = { RECORRENTE: "Recorrente", PONTUAL: "Pontual" };
const STATUS_LABELS: Record<string, string> = { PREVISTA: "Prevista", CONFIRMADA: "Confirmada", RECEBIDA: "Recebida", INADIMPLENTE: "Inadimplente" };

const STATUS_COLORS: Record<string, string> = {
  PREVISTA:     "bg-zinc-500/15 text-zinc-400",
  CONFIRMADA:   "bg-blue-500/15 text-blue-400",
  RECEBIDA:     "bg-emerald-500/15 text-emerald-400",
  INADIMPLENTE: "bg-rose-500/15 text-rose-400",
};

const EMPTY_FORM = {
  descricao: "", valor: "", linha: "INNOBI", tipo: "RECORRENTE",
  status: "PREVISTA", competencia: "", clienteId: "",
};

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [mes, setMes] = useState(mesAtual);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [historico, setHistorico] = useState<MrrHistoricoItem[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Saldo em caixa — editável inline
  const [saldoEdit, setSaldoEdit] = useState(false);
  const [saldoInput, setSaldoInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, hist, rec, cls] = await Promise.all([
        fetch(`/api/financeiro/resumo?mes=${mes}`).then((r) => r.json()),
        fetch("/api/financeiro/mrr-historico").then((r) => r.json()),
        fetch(`/api/receitas?mes=${mes}`).then((r) => r.json()),
        fetch("/api/clients").then((r) => r.json()),
      ]);
      setResumo(res);
      setHistorico(hist);
      setReceitas(rec);
      setClients(cls);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, competencia: mes });
    setDrawerOpen(true);
  }

  function openEdit(r: Receita) {
    setEditingId(r.id);
    setForm({
      descricao: r.descricao,
      valor: String(r.valorCentavos / 100),
      linha: r.linha,
      tipo: r.tipo,
      status: r.status,
      competencia: r.competencia.slice(0, 7),
      clienteId: r.clienteId ?? "",
    });
    setDrawerOpen(true);
  }

  function closeDrawer() { setDrawerOpen(false); setEditingId(null); setForm(EMPTY_FORM); }

  async function save() {
    if (!form.descricao.trim() || !form.competencia) return;
    setSaving(true);
    try {
      const body = {
        descricao:     form.descricao,
        valorCentavos: parseBRL(form.valor),
        linha:         form.linha,
        tipo:          form.tipo,
        status:        form.status,
        competencia:   form.competencia,
        clienteId:     form.clienteId || null,
      };

      if (editingId) {
        const r = await fetch(`/api/receitas/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).then((r) => r.json());
        setReceitas((prev) => prev.map((x) => x.id === editingId ? r : x));
      } else {
        const r = await fetch("/api/receitas", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).then((r) => r.json());
        setReceitas((prev) => [r, ...prev]);
      }

      // Recarrega resumo para atualizar KPIs em tempo real
      const updated = await fetch(`/api/financeiro/resumo?mes=${mes}`).then((r) => r.json());
      setResumo(updated);
      closeDrawer();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/receitas/${id}`, { method: "DELETE" });
    setReceitas((prev) => prev.filter((r) => r.id !== id));
    const updated = await fetch(`/api/financeiro/resumo?mes=${mes}`).then((r) => r.json());
    setResumo(updated);
  }

  async function saveSaldo() {
    const centavos = parseBRL(saldoInput);
    await fetch("/api/config/saldo", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saldoCaixa: centavos }),
    });
    const updated = await fetch(`/api/financeiro/resumo?mes=${mes}`).then((r) => r.json());
    setResumo(updated);
    setSaldoEdit(false);
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────

  function KpiCard({
    label, value, sub, icon: Icon, color, danger,
  }: {
    label: string; value: string; sub?: string;
    icon: React.ElementType; color: string; danger?: boolean;
  }) {
    return (
      <div className="card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>{label}</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: `${color}18`, border: `1px solid ${color}22` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${danger ? "text-rose-400" : ""}`}
          style={!danger ? { color: "var(--foreground)" } : {}}>
          {value}
        </p>
        {sub && <p className="text-xs" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
    );
  }

  const runwayDisplay = resumo?.runway != null
    ? `${resumo.runway} ${resumo.runway === 1 ? "mês" : "meses"}`
    : "dados insuficientes";

  const runwayDanger = resumo?.runway != null && resumo.runway <= 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>MRR, receitas e runway</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
            style={{ colorScheme: "dark" }}
          />
          <button onClick={openNew} className="btn-primary">
            <Plus className="h-4 w-4" /> Nova receita
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="MRR atual"
          value={resumo ? fmtBRL(resumo.mrrAtual) : "—"}
          sub={resumo?.mrrVariacao != null
            ? `${resumo.mrrVariacao >= 0 ? "+" : ""}${resumo.mrrVariacao.toFixed(1)}% vs mês anterior`
            : "sem dado anterior"}
          icon={TrendingUp}
          color="#4F8CFF"
        />
        <KpiCard
          label="Receita pontual"
          value={resumo ? fmtBRL(resumo.receitaPontual) : "—"}
          sub="não entra no MRR"
          icon={BarChart3}
          color="#7C5CFF"
        />
        <KpiCard
          label="A receber"
          value={resumo ? fmtBRL(resumo.aReceber) : "—"}
          sub="confirmadas, não recebidas"
          icon={Clock}
          color="#F59E0B"
        />
        {/* Runway — com saldo editável inline */}
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>Runway</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: `${runwayDanger ? "#EF444418" : "#22C55E18"}`, border: `1px solid ${runwayDanger ? "#EF444422" : "#22C55E22"}` }}>
              <DollarSign className="h-4 w-4" style={{ color: runwayDanger ? "#EF4444" : "#22C55E" }} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${runwayDanger ? "text-rose-400" : ""}`}
            style={!runwayDanger ? { color: "var(--foreground)" } : {}}>
            {resumo ? runwayDisplay : "—"}
          </p>
          {/* Saldo editável */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--muted-2)" }}>Saldo:</span>
            {saldoEdit ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={saldoInput}
                  onChange={(e) => setSaldoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveSaldo(); if (e.key === "Escape") setSaldoEdit(false); }}
                  placeholder="0,00"
                  className="w-24 rounded border border-border bg-surface-2 px-2 py-0.5 text-xs outline-none focus:border-brand"
                />
                <button onClick={saveSaldo} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setSaldoEdit(false)} className="text-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setSaldoInput(resumo ? String(resumo.saldoCaixa / 100) : "0"); setSaldoEdit(true); }}
                className="flex items-center gap-1 text-xs hover:text-foreground transition-colors"
                style={{ color: "var(--muted)" }}
              >
                {resumo ? fmtBRL(resumo.saldoCaixa) : "—"}
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MRR Chart */}
      <div className="card p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold">MRR por linha de receita</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Últimos 6 meses — apenas recorrentes confirmadas/recebidas</p>
        </div>
        {loading ? (
          <div className="h-[220px] rounded-2xl animate-pulse" style={{ background: "var(--surface-2)" }} />
        ) : (
          <MrrStackedBarChart data={historico} />
        )}
      </div>

      {/* Receitas table */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">
            Receitas — {new Date(mes + "-02").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={openNew} className="btn-secondary text-xs px-3 py-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm" style={{ color: "var(--muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : receitas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <DollarSign className="h-10 w-10" style={{ color: "var(--muted-2)" }} />
            <div>
              <p className="font-medium">Nenhuma receita neste mês</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Clique em "Nova receita" para lançar.</p>
            </div>
          </div>
        ) : (
          <table className="premium-table w-full">
            <thead>
              <tr>
                {["Descrição", "Linha", "Tipo", "Status", "Valor"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {receitas.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div>
                      <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{r.descricao}</p>
                      {r.cliente && <p className="text-xs" style={{ color: "var(--muted)" }}>{r.cliente.name}</p>}
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      {LINHA_LABELS[r.linha] ?? r.linha}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs" style={{ color: r.tipo === "RECORRENTE" ? "#4F8CFF" : "#7C5CFF" }}>
                      {TIPO_LABELS[r.tipo] ?? r.tipo}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? ""}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                      {fmtBRL(r.valorCentavos)}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(r)} className="rounded p-1 text-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(r.id)} className="rounded p-1 text-muted hover:text-rose-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col"
            style={{ background: "var(--background)", borderLeft: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">{editingId ? "Editar receita" : "Nova receita"}</h2>
              <button onClick={closeDrawer} className="rounded-lg p-1.5 text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Descrição *</label>
                <input
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Innobi — Imobiliária Alfa"
                  className="premium-input"
                />
              </div>

              {/* Valor */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Valor (R$) *</label>
                <input
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                  placeholder="1997,00"
                  className="premium-input"
                />
              </div>

              {/* Linha + Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Linha</label>
                  <div className="relative">
                    <select value={form.linha} onChange={(e) => setForm((f) => ({ ...f, linha: e.target.value }))}
                      className="premium-input appearance-none pr-8">
                      {LINHAS.map((l) => <option key={l} value={l}>{LINHA_LABELS[l]}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Tipo</label>
                  <div className="relative">
                    <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                      className="premium-input appearance-none pr-8">
                      {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </div>
              </div>

              {/* Status + Competência */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="premium-input appearance-none pr-8">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Competência</label>
                  <input
                    type="month"
                    value={form.competencia}
                    onChange={(e) => setForm((f) => ({ ...f, competencia: e.target.value }))}
                    className="premium-input"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              </div>

              {/* Cliente */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Cliente (opcional)</label>
                <div className="relative">
                  <select value={form.clienteId} onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
                    className="premium-input appearance-none pr-8">
                    <option value="">Sem vínculo</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>

            <div className="border-t border-border px-6 py-4 flex gap-3">
              <button
                onClick={save}
                disabled={saving || !form.descricao.trim() || !form.competencia}
                className="btn-primary flex-1 justify-center"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "Salvar" : "Criar receita"}
              </button>
              <button onClick={closeDrawer} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
