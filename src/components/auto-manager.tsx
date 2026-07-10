"use client";

import { useEffect, useState } from "react";
import {
  Trash2, Pencil, Zap, MessageSquare, Send,
  ChevronDown, Loader2, AlertCircle, CheckCircle2,
  ToggleLeft, ToggleRight, Plus, X, Check, ChevronRight,
} from "lucide-react";

interface Rule {
  id: string;
  name: string;
  keywords: string;
  replyText: string;
  sendDm: boolean;
  dmText: string;
  mediaId: string | null;
  isActive: boolean;
  triggerCount: number;
  createLead: boolean;
  leadLinha: string | null;
}

interface Post {
  id: string;
  igId: string | null;
  caption: string | null;
  mediaType: string;
  postedAt: string;
}

interface PreviewItem {
  commentId: string;
  username: string;
  text: string;
  ruleName: string;
  ruleId: string;
  willReply: boolean;
  willDm: boolean;
  hasSenderId: boolean;
}

interface ApplyResult {
  total: number;
  matched: number;
  replied: number;
  dmSent: number;
  skipped: number;
  preview: PreviewItem[];
}

const LINHAS_RECEITA = [
  { key: "INNOBI",   label: "Innobi" },
  { key: "MENTORIA", label: "Mentoria" },
  { key: "SERVICOS", label: "Serviços" },
];

const EMPTY_FORM = { name: "", keywords: "", replyText: "", sendDm: false, dmText: "", mediaId: "", createLead: false, leadLinha: "SERVICOS" };

export function AutoManager({ posts }: { posts: Post[] }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  // Apply section
  const [selectedPostId, setSelectedPostId] = useState<string>(posts[0]?.igId ?? "");
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/automacoes/rules")
      .then((r) => r.json())
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      keywords: rule.keywords,
      replyText: rule.replyText,
      sendDm: rule.sendDm,
      dmText: rule.dmText,
      mediaId: rule.mediaId ?? "",
      createLead: rule.createLead,
      leadLinha: rule.leadLinha ?? "SERVICOS",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function saveRule() {
    if (!form.keywords.trim()) { setFormError("Preencha ao menos uma palavra-chave."); return; }
    if (!form.replyText.trim() && !form.dmText.trim()) { setFormError("Preencha a resposta no comentário ou o texto do direct."); return; }
    if (form.dmText.length > 1000) { setFormError("O texto do direct ultrapassa 1000 caracteres."); return; }
    if (form.createLead && !form.leadLinha) { setFormError("Escolha a linha de receita para gerar leads."); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const res = await fetch(`/api/automacoes/rules/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, sendDm: form.sendDm, createLead: form.createLead }),
        });
        const updated: Rule = await res.json();
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const res = await fetch("/api/automacoes/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) { const err = await res.json(); setFormError(err.error ?? "Erro ao criar regra"); return; }
        const created: Rule = await res.json();
        setRules((prev) => [...prev, created]);
      }
      closeDrawer();
    } catch { setFormError("Erro de conexão."); }
    finally { setSaving(false); }
  }

  async function deleteRule(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await fetch(`/api/automacoes/rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function toggleRule(rule: Rule) {
    const res = await fetch(`/api/automacoes/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    const updated: Rule = await res.json();
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  }

  async function previewApply() {
    if (!selectedPostId) return;
    setApplying(true); setPreview(null); setApplyResult(null); setApplyError(null);
    try {
      const res = await fetch("/api/automacoes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: selectedPostId, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) { setApplyError(data.error ?? "Erro ao buscar comentários"); return; }
      setPreview(data.preview ?? []);
      setApplyResult(data);
    } catch { setApplyError("Erro de conexão."); }
    finally { setApplying(false); }
  }

  async function applyNow() {
    if (!selectedPostId) return;
    setApplying(true); setApplyError(null);
    try {
      const res = await fetch("/api/automacoes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: selectedPostId, dryRun: false }),
      });
      const data: ApplyResult = await res.json();
      if (!res.ok) { setApplyError((data as { error?: string }).error ?? "Erro"); return; }
      setApplyResult(data);
      setPreview(data.preview);
      setRules((prev) =>
        prev.map((r) => {
          const count = data.preview.filter((p) => p.ruleId === r.id).length;
          return count > 0 ? { ...r, triggerCount: r.triggerCount + count } : r;
        })
      );
    } catch { setApplyError("Erro de conexão."); }
    finally { setApplying(false); }
  }

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <>
      {/* ── Botão Nova automação (cabeçalho) ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">
            {loading ? "Carregando…" : `${activeCount} regra${activeCount !== 1 ? "s" : ""} ativa${activeCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={openNew}
          className="brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nova automação
        </button>
      </div>

      {/* ── Lista de regras ── */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando regras…
          </div>
        )}

        {!loading && rules.length === 0 && (
          <div className="card flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
              <Zap className="h-6 w-6 text-brand" />
            </div>
            <div>
              <p className="font-medium">Nenhuma automação criada</p>
              <p className="mt-1 text-sm text-muted">Crie sua primeira regra para responder comentários automaticamente.</p>
            </div>
            <button
              onClick={openNew}
              className="brand-gradient mt-1 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Criar primeira regra
            </button>
          </div>
        )}

        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`card p-5 transition-opacity ${!rule.isActive ? "opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-4">
              {/* Info */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {rule.isActive
                    ? <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    : <span className="h-2 w-2 rounded-full bg-border" />}
                  <p className="font-medium">{rule.name || "Sem nome"}</p>
                  <span className="text-xs text-muted">· {rule.triggerCount} disparos</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {rule.keywords.split(",").map((kw) => (
                    <span key={kw} className="rounded-md bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
                      {kw.trim()}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-muted">
                  {rule.mediaId
                    ? `Post: ${posts.find((p) => p.igId === rule.mediaId)?.caption?.slice(0, 50) ?? "post específico"}`
                    : "Todos os posts"}
                </p>

                <div className="space-y-1">
                  {rule.replyText && (
                    <p className="line-clamp-1 text-sm text-muted">
                      <span className="text-xs font-medium text-foreground/60">💬 Comentário:</span> {rule.replyText}
                    </p>
                  )}
                  {rule.sendDm && rule.dmText && (
                    <p className="line-clamp-1 text-sm text-muted">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                        <Send className="h-3 w-3" /> DM:
                      </span>{" "}{rule.dmText}
                    </p>
                  )}
                  {rule.createLead && rule.leadLinha && (
                    <p className="text-xs font-medium" style={{ color: "#22C55E" }}>
                      🎯 Gera lead · {LINHAS_RECEITA.find(l => l.key === rule.leadLinha)?.label ?? rule.leadLinha}
                    </p>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => toggleRule(rule)}
                  className="rounded-lg p-1.5 text-muted hover:text-foreground"
                  title={rule.isActive ? "Desativar" : "Ativar"}
                >
                  {rule.isActive
                    ? <ToggleRight className="h-5 w-5 text-brand" />
                    : <ToggleLeft className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => openEdit(rule)}
                  className="rounded-lg p-1.5 text-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="rounded-lg p-1.5 text-muted hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Aplicar em comentários (colapsável) ── */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setApplyOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-brand" />
            <span className="text-sm font-medium">Aplicar em comentários existentes</span>
          </div>
          <ChevronRight className={`h-4 w-4 text-muted transition-transform ${applyOpen ? "rotate-90" : ""}`} />
        </button>

        {applyOpen && (
          <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
            <p className="text-sm text-muted">
              Selecione um post para buscar comentários e aplicar as regras ativas.
            </p>

            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-0 flex-1">
                <select
                  value={selectedPostId}
                  onChange={(e) => { setSelectedPostId(e.target.value); setPreview(null); setApplyResult(null); }}
                  className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 pr-8 text-sm outline-none focus:border-brand"
                >
                  {posts.filter((p) => p.igId).map((p) => (
                    <option key={p.id} value={p.igId!}>
                      [{p.mediaType}] {p.caption?.slice(0, 60) ?? "Sem legenda"} — {new Date(p.postedAt).toLocaleDateString("pt-BR")}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
              <button
                onClick={previewApply}
                disabled={applying || !selectedPostId || activeCount === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-surface-2/80 disabled:opacity-40"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Buscar comentários
              </button>
            </div>

            {applyError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" /> {applyError}
              </div>
            )}

            {applyResult && applyResult.replied === 0 && (
              <div className="rounded-lg border border-border bg-surface-2/30 p-4 text-sm text-muted">
                <span className="font-medium text-foreground">{applyResult.total}</span> comentários encontrados —{" "}
                <span className="font-medium text-brand">{applyResult.matched}</span> correspondem às regras ativas.
              </div>
            )}

            {applyResult && ((applyResult.replied ?? 0) > 0 || (applyResult.dmSent ?? 0) > 0) && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {(applyResult.replied ?? 0) > 0 && `${applyResult.replied} respondido${applyResult.replied > 1 ? "s" : ""}`}
                {(applyResult.replied ?? 0) > 0 && (applyResult.dmSent ?? 0) > 0 && " · "}
                {(applyResult.dmSent ?? 0) > 0 && `${applyResult.dmSent} DM${applyResult.dmSent > 1 ? "s enviados" : " enviado"}`}
              </div>
            )}

            {preview && preview.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Comentários que serão respondidos</p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {preview.map((item) => (
                    <div key={item.commentId} className="flex items-start gap-3 rounded-lg bg-surface-2/50 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted">@{item.username || "anônimo"}</p>
                        <p className="text-sm">{item.text}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {item.willReply && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">💬 comentário</span>}
                        {item.willDm && <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">✉️ DM</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {!applyResult?.replied && (
                  <button
                    onClick={applyNow}
                    disabled={applying}
                    className="brand-gradient inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {applying ? <><Loader2 className="h-4 w-4 animate-spin" /> Respondendo…</> : <><Zap className="h-4 w-4" /> Aplicar regras ({preview.length} comentário{preview.length > 1 ? "s" : ""})</>}
                  </button>
                )}
              </div>
            )}

            {preview && preview.length === 0 && applyResult && (
              <p className="text-sm text-muted">Nenhum comentário correspondeu às regras ativas neste post.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Drawer (Nova / Editar regra) ── */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={closeDrawer}
          />
          {/* Painel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl">
            {/* Header do drawer */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-semibold">{editingId ? "Editar regra" : "Nova automação"}</h2>
              </div>
              <button onClick={closeDrawer} className="rounded-lg p-1.5 text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulário */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Nome da regra</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Solicitar link"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Palavras-chave <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                  placeholder="quero, link, onde comprar"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand"
                />
                <p className="text-xs text-muted">Separe por vírgula. Ignora acentos e maiúsculas.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Aplicar em</label>
                <div className="relative">
                  <select
                    value={form.mediaId}
                    onChange={(e) => setForm((f) => ({ ...f, mediaId: e.target.value }))}
                    className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 pr-8 text-sm outline-none focus:border-brand"
                  >
                    <option value="">Todos os posts</option>
                    {posts.filter((p) => p.igId).map((p) => (
                      <option key={p.id} value={p.igId!}>
                        [{p.mediaType}] {p.caption?.slice(0, 50) ?? "Sem legenda"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Resposta no comentário</label>
                <textarea
                  value={form.replyText}
                  onChange={(e) => setForm((f) => ({ ...f, replyText: e.target.value }))}
                  placeholder="Oi! Confere o link na bio 👆 (deixe vazio para não responder publicamente)"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand"
                />
              </div>

              {/* DM toggle */}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, sendDm: !f.sendDm }))}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  form.sendDm ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                <Send className={`h-4 w-4 ${form.sendDm ? "text-brand" : ""}`} />
                {form.sendDm ? "Enviar DM ativado" : "Também enviar DM?"}
                {form.sendDm ? <ToggleRight className="ml-auto h-5 w-5 text-brand" /> : <ToggleLeft className="ml-auto h-5 w-5" />}
              </button>

              {form.sendDm && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Texto do direct</label>
                  <textarea
                    value={form.dmText}
                    onChange={(e) => setForm((f) => ({ ...f, dmText: e.target.value }))}
                    placeholder="Oi! Aqui está o link que você pediu: https://..."
                    rows={4}
                    className={`w-full resize-none rounded-lg border px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand ${
                      form.dmText.length > 1000 ? "border-rose-500 bg-rose-500/5" : "border-brand/40 bg-brand/5"
                    }`}
                  />
                  <p className={`text-right text-xs ${form.dmText.length > 1000 ? "text-rose-400 font-medium" : "text-muted"}`}>
                    {form.dmText.length}/1000
                  </p>
                </div>
              )}

              {/* Pipeline toggle */}
              <div className="rounded-xl border border-border bg-surface-2/30 p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, createLead: !f.createLead }))}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    form.createLead
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-surface-2 text-muted hover:text-foreground"
                  }`}
                >
                  <span className="text-base">🎯</span>
                  {form.createLead ? "Gerar lead no pipeline ativado" : "Gerar lead no pipeline?"}
                  {form.createLead
                    ? <ToggleRight className="ml-auto h-5 w-5 text-emerald-400" />
                    : <ToggleLeft className="ml-auto h-5 w-5" />}
                </button>

                {form.createLead && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted">Linha de receita do lead</label>
                    <div className="relative">
                      <select
                        value={form.leadLinha}
                        onChange={(e) => setForm((f) => ({ ...f, leadLinha: e.target.value }))}
                        className="w-full appearance-none rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 pr-8 text-sm outline-none focus:border-emerald-400"
                      >
                        {LINHAS_RECEITA.map((l) => (
                          <option key={l.key} value={l.key}>{l.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    </div>
                    <p className="text-xs text-muted">O lead é criado no pipeline com próxima ação automática. Deduplicado por usuário + post.</p>
                  </div>
                )}
              </div>

              {formError && (
                <p className="flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" /> {formError}
                </p>
              )}
            </div>

            {/* Footer do drawer */}
            <div className="border-t border-border px-6 py-4 flex gap-3">
              <button
                onClick={saveRule}
                disabled={saving}
                className="brand-gradient flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "Salvar alterações" : "Criar automação"}
              </button>
              <button
                onClick={closeDrawer}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}