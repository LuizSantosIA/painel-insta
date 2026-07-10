"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Plus, X, Check, Trash2, Loader2, ChevronDown, Circle, CheckCircle2 } from "lucide-react";

interface Client { id: string; name: string; }
interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  done: boolean;
  priority: string;
  clientId: string | null;
  client: Client | null;
}

const PRIORITY_STYLES: Record<string, string> = {
  high:   "bg-rose-500/15 text-rose-400",
  medium: "bg-amber-500/15 text-amber-400",
  low:    "bg-zinc-500/15 text-zinc-400",
};
const PRIORITY_LABELS: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };

const EMPTY_FORM = { title: "", description: "", dueDate: "", priority: "medium", clientId: "" };

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}
function isToday(dueDate: string | null) {
  if (!dueDate) return false;
  return dueDate.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export default function TarefasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "overdue" | "done">("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/clients").then(r => r.json()),
    ]).then(([t, c]) => { setTasks(t); setClients(c); }).finally(() => setLoading(false));
  }, []);

  async function toggle(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !task.done }) });
    const updated = await res.json();
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
  }

  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, dueDate: form.dueDate || null, clientId: form.clientId || null };
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const created = await res.json();
      setTasks(prev => [created, ...prev]);
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
    } finally { setSaving(false); }
  }

  const filtered = tasks.filter(t => {
    if (filter === "done") return t.done;
    if (filter === "today") return !t.done && isToday(t.dueDate);
    if (filter === "overdue") return !t.done && isOverdue(t.dueDate);
    return !t.done;
  });

  const pending = tasks.filter(t => !t.done).length;
  const overdue = tasks.filter(t => !t.done && isOverdue(t.dueDate)).length;
  const todayCount = tasks.filter(t => !t.done && isToday(t.dueDate)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl">
            <CheckSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
            <p className="text-sm text-muted">{pending} pendente{pending !== 1 ? "s" : ""}{overdue > 0 ? ` · ${overdue} atrasada${overdue !== 1 ? "s" : ""}` : ""}</p>
          </div>
        </div>
        <button onClick={() => setDrawerOpen(true)} className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm">
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold">{pending}</p>
          <p className="text-xs text-muted mt-1">Pendentes</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-2xl font-semibold ${todayCount > 0 ? "text-amber-400" : ""}`}>{todayCount}</p>
          <p className="text-xs text-muted mt-1">Para hoje</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-2xl font-semibold ${overdue > 0 ? "text-rose-400" : ""}`}>{overdue}</p>
          <p className="text-xs text-muted mt-1">Atrasadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {([["all", "Pendentes"], ["today", "Hoje"], ["overdue", "Atrasadas"], ["done", "Concluídas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-xs transition-colors ${filter === k ? "bg-foreground text-background" : "border border-border text-muted hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted" />
          <div>
            <p className="font-medium">{filter === "done" ? "Nenhuma tarefa concluída ainda" : "Tudo em dia!"}</p>
            <p className="mt-1 text-sm text-muted">{filter === "all" ? "Crie uma tarefa para começar." : "Nenhuma tarefa neste filtro."}</p>
          </div>
          {filter === "all" && (
            <button onClick={() => setDrawerOpen(true)} className="brand-gradient mt-1 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white">
              <Plus className="h-4 w-4" /> Criar tarefa
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className={`card flex items-start gap-3 p-4 transition-opacity ${task.done ? "opacity-50" : ""}`}>
              <button onClick={() => toggle(task)} className="mt-0.5 shrink-0 text-muted hover:text-brand transition-colors">
                {task.done ? <CheckCircle2 className="h-5 w-5 text-brand" /> : <Circle className="h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${task.done ? "line-through text-muted" : ""}`}>{task.title}</p>
                {task.description && <p className="mt-0.5 text-sm text-muted">{task.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                  {task.client && <span className="text-xs text-muted">· {task.client.name}</span>}
                  {task.dueDate && (
                    <span className={`text-xs ${isOverdue(task.dueDate) && !task.done ? "text-rose-400 font-medium" : isToday(task.dueDate) ? "text-amber-400 font-medium" : "text-muted"}`}>
                      · {isOverdue(task.dueDate) && !task.done ? "Atrasada — " : isToday(task.dueDate) ? "Hoje — " : ""}{new Date(task.dueDate).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(task.id)} className="shrink-0 rounded p-1 text-muted hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Drawer nova tarefa */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => { setDrawerOpen(false); setForm(EMPTY_FORM); }} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">Nova tarefa</h2>
              <button onClick={() => { setDrawerOpen(false); setForm(EMPTY_FORM); }} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="O que precisa ser feito?" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes opcionais…" rows={2} className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Prazo</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Prioridade</label>
                  <div className="relative">
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand pr-8">
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Cliente relacionado</label>
                <div className="relative">
                  <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand pr-8">
                    <option value="">Nenhum</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>
            <div className="border-t border-border px-6 py-4 flex gap-3">
              <button onClick={save} disabled={saving || !form.title.trim()} className="brand-gradient flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Criar tarefa
              </button>
              <button onClick={() => { setDrawerOpen(false); setForm(EMPTY_FORM); }} className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground">Cancelar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
