"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Plus, X, Check, Trash2, Pencil, Loader2, ChevronDown, DollarSign } from "lucide-react";

interface Client { id: string; name: string; }
interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  notes: string | null;
  dueDate: string | null;
  clientId: string | null;
  client: Client | null;
}

const STAGES = [
  { key: "lead",        label: "Leads",       color: "bg-blue-500/15 text-blue-400",    border: "border-blue-500/20" },
  { key: "contacted",   label: "Contactados", color: "bg-purple-500/15 text-purple-400", border: "border-purple-500/20" },
  { key: "proposal",    label: "Proposta",    color: "bg-amber-500/15 text-amber-400",   border: "border-amber-500/20" },
  { key: "negotiation", label: "Negociação",  color: "bg-orange-500/15 text-orange-400", border: "border-orange-500/20" },
  { key: "won",         label: "Fechados",    color: "bg-emerald-500/15 text-emerald-400", border: "border-emerald-500/20" },
  { key: "lost",        label: "Perdidos",    color: "bg-rose-500/15 text-rose-400",     border: "border-rose-500/20" },
];

const EMPTY_FORM = { title: "", value: "", stage: "lead", notes: "", dueDate: "", clientId: "" };

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [defaultStage, setDefaultStage] = useState("lead");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/deals").then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
    ]).then(([d, c]) => { setDeals(d); setClients(c); }).finally(() => setLoading(false));
  }, []);

  function openNew(stage = "lead") {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, stage });
    setDefaultStage(stage);
    setDrawerOpen(true);
  }

  function openEdit(deal: Deal) {
    setEditingId(deal.id);
    setForm({ title: deal.title, value: String(deal.value), stage: deal.stage, notes: deal.notes || "", dueDate: deal.dueDate ? deal.dueDate.slice(0, 10) : "", clientId: deal.clientId || "" });
    setDrawerOpen(true);
  }

  function closeDrawer() { setDrawerOpen(false); setEditingId(null); setForm(EMPTY_FORM); }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, value: parseFloat(form.value) || 0, dueDate: form.dueDate || null, clientId: form.clientId || null };
      if (editingId) {
        const res = await fetch(`/api/deals/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const updated = await res.json();
        setDeals(prev => prev.map(d => d.id === editingId ? updated : d));
      } else {
        const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const created = await res.json();
        setDeals(prev => [created, ...prev]);
      }
      closeDrawer();
    } finally { setSaving(false); }
  }

  async function moveStage(deal: Deal, stage: string) {
    const res = await fetch(`/api/deals/${deal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    const updated = await res.json();
    setDeals(prev => prev.map(d => d.id === deal.id ? updated : d));
  }

  async function remove(id: string) {
    if (!confirm("Excluir negócio?")) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setDeals(prev => prev.filter(d => d.id !== id));
  }

  const totalWon = deals.filter(d => d.stage === "won").reduce((s, d) => s + d.value, 0);
  const totalPipeline = deals.filter(d => !["won","lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted">{deals.filter(d => !["won","lost"].includes(d.stage)).length} negócio{deals.length !== 1 ? "s" : ""} em andamento</p>
          </div>
        </div>
        <button onClick={() => openNew()} className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm">
          <Plus className="h-4 w-4" /> Novo negócio
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Em pipeline</p>
          <p className="mt-1 text-xl font-semibold">{fmt(totalPipeline)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Fechados</p>
          <p className="mt-1 text-xl font-semibold text-emerald-400">{fmt(totalWon)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Total de negócios</p>
          <p className="mt-1 text-xl font-semibold">{deals.length}</p>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageDealss = deals.filter(d => d.stage === stage.key);
            const stageTotal = stageDealss.reduce((s, d) => s + d.value, 0);
            return (
              <div key={stage.key} className="flex w-72 shrink-0 flex-col gap-3">
                {/* Column header */}
                <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${stage.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.color}`}>{stage.label}</span>
                    <span className="text-xs text-muted">{stageDealss.length}</span>
                  </div>
                  {stageTotal > 0 && <span className="text-xs text-muted">{fmt(stageTotal)}</span>}
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 min-h-[60px]">
                  {stageDealss.map(deal => (
                    <div key={deal.id} className="card p-4 space-y-2 cursor-default">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{deal.title}</p>
                        <div className="flex shrink-0 gap-0.5">
                          <button onClick={() => openEdit(deal)} className="rounded p-1 text-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(deal.id)} className="rounded p-1 text-muted hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {deal.client && <p className="text-xs text-muted">{deal.client.name}</p>}
                      {deal.value > 0 && (
                        <p className="flex items-center gap-1 text-sm font-semibold text-brand">
                          <DollarSign className="h-3.5 w-3.5" />{fmt(deal.value)}
                        </p>
                      )}
                      {/* Move stage buttons */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {STAGES.filter(s => s.key !== stage.key).slice(0, 3).map(s => (
                          <button key={s.key} onClick={() => moveStage(deal, s.key)} className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted hover:border-brand hover:text-brand transition-colors">
                            → {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => openNew(stage.key)} className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted hover:border-brand hover:text-brand transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">{editingId ? "Editar negócio" : "Novo negócio"}</h2>
              <button onClick={closeDrawer} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {[
                { key: "title", label: "Título *", placeholder: "Ex: Mentoria 3 meses" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted">{label}</label>
                  <input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Valor (R$)</label>
                <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0,00" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Etapa</label>
                <div className="relative">
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand pr-8">
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Cliente</label>
                <div className="relative">
                  <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand pr-8">
                    <option value="">Sem cliente vinculado</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Prazo</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Observações</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Detalhes do negócio…" rows={3} className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
              </div>
            </div>
            <div className="border-t border-border px-6 py-4 flex gap-3">
              <button onClick={save} disabled={saving || !form.title.trim()} className="brand-gradient flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "Salvar" : "Criar negócio"}
              </button>
              <button onClick={closeDrawer} className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground">Cancelar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
