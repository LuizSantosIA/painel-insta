"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Search, X, Check, Pencil, Trash2, Phone, Mail, Loader2, ChevronDown, Tag } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  company: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  tags: string | null;
  createdAt: string;
  deals: { id: string; stage: string; value: number }[];
  tasks: { id: string }[];
}

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  active: "Cliente",
  inactive: "Inativo",
  lost: "Perdido",
};

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-blue-500/15 text-blue-400",
  active: "bg-emerald-500/15 text-emerald-400",
  inactive: "bg-zinc-500/15 text-zinc-400",
  lost: "bg-rose-500/15 text-rose-400",
};

const EMPTY_FORM = { name: "", email: "", phone: "", instagram: "", company: "", notes: "", status: "lead", source: "", tags: "" };

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(setClients).finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c => {
    const q = query.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q) || c.instagram?.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || c.status === statusFilter;
    return matchQ && matchS;
  });

  function openNew() { setEditingId(null); setForm(EMPTY_FORM); setDrawerOpen(true); }
  function openEdit(c: Client) {
    setEditingId(c.id);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", instagram: c.instagram || "", company: c.company || "", notes: c.notes || "", status: c.status, source: c.source || "", tags: c.tags || "" });
    setDrawerOpen(true);
    setSelected(null);
  }
  function closeDrawer() { setDrawerOpen(false); setEditingId(null); setForm(EMPTY_FORM); }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/clients/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const updated = await res.json();
        setClients(prev => prev.map(c => c.id === editingId ? { ...c, ...updated } : c));
        if (selected?.id === editingId) setSelected({ ...selected, ...updated });
      } else {
        const res = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const created = await res.json();
        setClients(prev => [{ ...created, deals: [], tasks: [] }, ...prev]);
      }
      closeDrawer();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Excluir cliente?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    setClients(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted">{clients.length} contato{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={openNew} className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm">
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail, telefone…" className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand" />
        </div>
        <div className="flex gap-2">
          {["all", "lead", "active", "inactive", "lost"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1.5 text-xs transition-colors ${statusFilter === s ? "bg-foreground text-background" : "border border-border text-muted hover:text-foreground"}`}>
              {s === "all" ? "Todos" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <Users className="h-10 w-10 text-muted" />
          <div>
            <p className="font-medium">Nenhum cliente encontrado</p>
            <p className="mt-1 text-sm text-muted">Adicione seu primeiro cliente para começar.</p>
          </div>
          <button onClick={openNew} className="brand-gradient mt-1 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Adicionar cliente
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Negócios</th>
                <th className="px-4 py-3 font-medium">Tarefas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-b border-border/60 hover:bg-surface-2/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        {c.company && <p className="text-xs text-muted">{c.company}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {c.phone && <p className="flex items-center gap-1 text-xs text-muted"><Phone className="h-3 w-3" /> {c.phone}</p>}
                      {c.email && <p className="flex items-center gap-1 text-xs text-muted"><Mail className="h-3 w-3" /> {c.email}</p>}
                      {c.instagram && <p className="flex items-center gap-1 text-xs text-muted"><span className="text-[10px]">IG</span> {c.instagram}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.deals.length}</td>
                  <td className="px-4 py-3 text-muted">{c.tasks.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(c)} className="rounded p-1 text-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(c.id)} className="rounded p-1 text-muted hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-background shadow-2xl border-l border-border">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">{selected.name.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  {selected.company && <p className="text-xs text-muted">{selected.company}</p>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
              <div className="space-y-2">
                {selected.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted" />{selected.phone}</div>}
                {selected.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted" />{selected.email}</div>}
                {selected.instagram && <div className="flex items-center gap-2 text-sm"><span className="text-xs font-bold text-muted">IG</span>@{selected.instagram}</div>}
              </div>
              {selected.tags && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.split(",").map(t => (
                    <span key={t} className="flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs text-brand"><Tag className="h-3 w-3" />{t.trim()}</span>
                  ))}
                </div>
              )}
              {selected.notes && <div className="rounded-lg bg-surface-2/50 p-3 text-sm text-muted">{selected.notes}</div>}
              <div className="pt-2 flex gap-2">
                <button onClick={() => openEdit(selected)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm hover:bg-surface-2">
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button onClick={() => remove(selected.id)} className="rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drawer novo/editar */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">{editingId ? "Editar cliente" : "Novo cliente"}</h2>
              <button onClick={closeDrawer} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {[
                { key: "name", label: "Nome *", placeholder: "Nome completo" },
                { key: "company", label: "Empresa", placeholder: "Nome da empresa" },
                { key: "phone", label: "Telefone / WhatsApp", placeholder: "(11) 99999-9999" },
                { key: "email", label: "E-mail", placeholder: "email@exemplo.com" },
                { key: "instagram", label: "Instagram", placeholder: "@usuario" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted">{label}</label>
                  <input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Status</label>
                <div className="relative">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand pr-8">
                    <option value="lead">Lead</option>
                    <option value="active">Cliente ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="lost">Perdido</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Origem</label>
                <div className="relative">
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand pr-8">
                    <option value="">Não informado</option>
                    <option value="instagram">Instagram</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="referral">Indicação</option>
                    <option value="organic">Orgânico</option>
                    <option value="other">Outro</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Tags</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="vip, parceiro, interessado" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
                <p className="text-xs text-muted">Separe por vírgula</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Observações</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anotações sobre o cliente…" rows={3} className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
              </div>
            </div>
            <div className="border-t border-border px-6 py-4 flex gap-3">
              <button onClick={save} disabled={saving || !form.name.trim()} className="brand-gradient flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "Salvar" : "Criar cliente"}
              </button>
              <button onClick={closeDrawer} className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground">Cancelar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
