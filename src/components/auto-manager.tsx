"use client";

import { useEffect, useState } from "react";
import {
  Trash2, Pencil, Check, X, Zap, MessageSquare, Send,
  ChevronDown, Loader2, AlertCircle, CheckCircle2, ToggleLeft, ToggleRight,
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

const EMPTY_FORM = { name: "", keywords: "", replyText: "", sendDm: false, dmText: "", mediaId: "" };

export function AutoManager({ posts }: { posts: Post[] }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      keywords: rule.keywords,
      replyText: rule.replyText,
      sendDm: rule.sendDm,
      dmText: rule.dmText,
      mediaId: rule.mediaId ?? "",
    });
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function saveRule() {
    if (!form.keywords.trim()) {
      setFormError("Preencha ao menos uma palavra-chave.");
      return;
    }
    if (!form.replyText.trim() && !form.dmText.trim()) {
      setFormError("Preencha a resposta no comentário ou o texto do direct.");
      return;
    }
    if (form.dmText.length > 1000) {
      setFormError("O texto do direct ultrapassa 1000 caracteres — Instagram não aceita mensagens mais longas.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const res = await fetch(`/api/automacoes/rules/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, sendDm: form.sendDm }),
        });
        const updated: Rule = await res.json();
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        setEditingId(null);
      } else {
        const res = await fetch("/api/automacoes/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          setFormError(err.error ?? "Erro ao criar regra");
          return;
        }
        const created: Rule = await res.json();
        setRules((prev) => [...prev, created]);
      }
      setForm(EMPTY_FORM);
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
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
    setApplying(true);
    setPreview(null);
    setApplyResult(null);
    setApplyError(null);
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
    } catch {
      setApplyError("Erro de conexão.");
    } finally {
      setApplying(false);
    }
  }

  async function applyNow() {
    if (!selectedPostId) return;
    setApplying(true);
    setApplyError(null);
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
      // update trigger counts
      setRules((prev) =>
        prev.map((r) => {
          const count = data.preview.filter((p) => p.ruleId === r.id).length;
          return count > 0 ? { ...r, triggerCount: r.triggerCount + count } : r;
        })
      );
    } catch {
      setApplyError("Erro de conexão.");
    } finally {
      setApplying(false);
    }
  }

  const isNewForm = editingId === null;

  return (
    <div className="space-y-8">
      {/* Rules list */}
      <section className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            <h2 className="font-semibold">Regras de automação</h2>
          </div>
          <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand">
            {rules.filter((r) => r.isActive).length} ativas
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) =>
              editingId === rule.id ? (
                <RuleForm
                  key={rule.id}
                  form={form}
                  setForm={setForm}
                  onSave={saveRule}
                  onCancel={cancelEdit}
                  saving={saving}
                  error={formError}
                  posts={posts}
                  isEdit
                />
              ) : (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    rule.isActive ? "border-border bg-surface-2/40" : "border-border/40 bg-surface-2/10 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {rule.name && (
                        <p className="text-sm font-medium">{rule.name}</p>
                      )}
                      <p className="text-xs text-muted">
                        {rule.mediaId
                          ? `Post: ${posts.find((p) => p.igId === rule.mediaId)?.caption?.slice(0, 40) ?? "post específico"}`
                          : "Todos os posts"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rule.keywords.split(",").map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand"
                          >
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                      {rule.replyText && (
                        <p className="text-sm text-muted line-clamp-1">
                          <span className="text-xs text-foreground/50">Comentário:</span> {rule.replyText}
                        </p>
                      )}
                      {rule.sendDm && rule.dmText && (
                        <p className="text-sm text-muted line-clamp-1">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                            <Send className="h-3 w-3" /> DM:
                          </span>{" "}
                          {rule.dmText}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="mr-2 text-xs text-muted">{rule.triggerCount} disparos</span>
                      <button
                        onClick={() => toggleRule(rule)}
                        className="rounded p-1 text-muted hover:text-foreground"
                        title={rule.isActive ? "Desativar" : "Ativar"}
                      >
                        {rule.isActive
                          ? <ToggleRight className="h-5 w-5 text-brand" />
                          : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => startEdit(rule)}
                        className="rounded p-1 text-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="rounded p-1 text-muted hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}

            {rules.length === 0 && !editingId && (
              <p className="text-sm text-muted">Nenhuma regra criada ainda.</p>
            )}
          </div>
        )}

        {isNewForm && (
          <div className="border-t border-border pt-5">
            <p className="mb-3 text-sm font-medium text-muted">Nova regra</p>
            <RuleForm
              form={form}
              setForm={setForm}
              onSave={saveRule}
              onCancel={() => setForm(EMPTY_FORM)}
              saving={saving}
              error={formError}
              posts={posts}
            />
          </div>
        )}
      </section>

      {/* Apply section */}
      <section className="card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand" />
          <h2 className="font-semibold">Aplicar em comentários</h2>
        </div>
        <p className="text-sm text-muted">
          Selecione um post, pré-visualize quais comentários serão respondidos e aplique as regras.
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1">
            <select
              value={selectedPostId}
              onChange={(e) => {
                setSelectedPostId(e.target.value);
                setPreview(null);
                setApplyResult(null);
              }}
              className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 pr-8 text-sm outline-none focus:border-brand"
            >
              {posts.filter((p) => p.igId).map((p) => (
                <option key={p.id} value={p.igId!}>
                  [{p.mediaType}] {p.caption?.slice(0, 60) ?? "Sem legenda"} —{" "}
                  {new Date(p.postedAt).toLocaleDateString("pt-BR")}
                </option>
              ))}
              {posts.filter((p) => p.igId).length === 0 && (
                <option value="">Nenhum post sincronizado</option>
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
          <button
            onClick={previewApply}
            disabled={applying || !selectedPostId || rules.filter((r) => r.isActive).length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-surface-2/80 disabled:opacity-40"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Buscar comentários
          </button>
        </div>

        {applyError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {applyError}
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
            {(applyResult.replied ?? 0) > 0 && `${applyResult.replied} comentário${applyResult.replied > 1 ? "s respondidos" : " respondido"}`}
            {(applyResult.replied ?? 0) > 0 && (applyResult.dmSent ?? 0) > 0 && " · "}
            {(applyResult.dmSent ?? 0) > 0 && `${applyResult.dmSent} DM${applyResult.dmSent > 1 ? "s enviados" : " enviado"}`}
          </div>
        )}

        {preview && preview.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">
              Comentários que serão respondidos
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {preview.map((item) => (
                <div key={item.commentId} className="flex items-start gap-3 rounded-lg bg-surface-2/50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted">@{item.username || "anônimo"}</p>
                    <p className="text-sm">{item.text}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.willReply && (
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                        💬 comentário
                      </span>
                    )}
                    {item.willDm && (
                      <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">
                        ✉️ DM
                      </span>
                    )}
                    {item.willDm && !item.hasSenderId && (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">
                        sem ID
                      </span>
                    )}
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
                {applying ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Respondendo…</>
                ) : (
                  <><Zap className="h-4 w-4" /> Aplicar regras ({preview.length} comentário{preview.length > 1 ? "s" : ""})</>
                )}
              </button>
            )}
          </div>
        )}

        {preview && preview.length === 0 && applyResult && (
          <p className="text-sm text-muted">
            Nenhum comentário correspondeu às regras ativas neste post.
          </p>
        )}
      </section>
    </div>
  );
}

function RuleForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  error,
  posts,
  isEdit = false,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  posts: Post[];
  isEdit?: boolean;
}) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="Nome da regra (opcional) — ex: Solicitar link"
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand"
      />
      <input
        type="text"
        value={form.keywords}
        onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
        placeholder="Palavras-chave separadas por vírgula — ex: quero, link, onde comprar"
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand"
      />
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
      <textarea
        value={form.replyText}
        onChange={(e) => setForm((f) => ({ ...f, replyText: e.target.value }))}
        placeholder="Resposta pública no comentário — ex: Oi! Confere o link na bio 👆 (deixe vazio para não responder)"
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand"
      />

      {/* DM toggle */}
      <button
        type="button"
        onClick={() => setForm((f) => ({ ...f, sendDm: !f.sendDm }))}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
          form.sendDm
            ? "border-brand bg-brand/10 text-brand"
            : "border-border bg-surface-2 text-muted hover:text-foreground"
        }`}
      >
        <Send className={`h-4 w-4 ${form.sendDm ? "text-brand" : ""}`} />
        {form.sendDm ? "Enviar DM ativado" : "Também enviar DM?"}
        {form.sendDm
          ? <ToggleRight className="ml-auto h-5 w-5 text-brand" />
          : <ToggleLeft className="ml-auto h-5 w-5" />}
      </button>

      {form.sendDm && (
        <div className="space-y-1">
          <textarea
            value={form.dmText}
            onChange={(e) => setForm((f) => ({ ...f, dmText: e.target.value }))}
            placeholder="Mensagem do direct — ex: Oi! Aqui está o link exclusivo que você pediu: ..."
            rows={3}
            className={`w-full resize-none rounded-lg border px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand ${
              form.dmText.length > 1000
                ? "border-rose-500 bg-rose-500/5"
                : "border-brand/40 bg-brand/5"
            }`}
          />
          <p className={`text-right text-xs ${form.dmText.length > 1000 ? "text-rose-400 font-medium" : "text-muted"}`}>
            {form.dmText.length}/1000{form.dmText.length > 1000 ? " — Instagram não aceita mensagens acima de 1000 caracteres" : ""}
          </p>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="brand-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {isEdit ? "Salvar alterações" : "Criar regra"}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}