"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Check, Loader2, ChevronDown } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import { fmtDataHumana } from "@/lib/cliente-360";
import type { ClienteListaItem } from "@/app/api/clients/route";
import { Avatar, SaudeIndicator, StatusBadge, labelStatus } from "@/components/cliente/saude-indicator";
import { RowMenu } from "@/components/cliente/row-menu";

const EMPTY_FORM = {
  name: "", email: "", phone: "", instagram: "", company: "",
  notes: "", status: "lead", source: "", tags: "",
};

/** Receita da linha: MRR quando há recorrência, senão o total já recebido. */
function textoReceita(c: ClienteListaItem): { valor: string; sufixo: string | null } | null {
  if (c.mrrCentavos > 0) return { valor: fmtBRL(c.mrrCentavos), sufixo: "/mês" };
  if (c.receitaRecebidaCentavos > 0) return { valor: fmtBRL(c.receitaRecebidaCentavos), sufixo: null };
  return null;
}

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClienteListaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((lista: ClienteListaItem[]) => {
        setClients(lista);
        // Veio do perfil 360° pelo menu Editar: abre o drawer daquele cliente.
        const alvo = new URLSearchParams(window.location.search).get("editar");
        const cliente = alvo ? lista.find((c) => c.id === alvo) : null;
        if (cliente) openEdit(cliente);
      })
      .finally(() => setLoading(false));
  }, []);

  // Aberto pelo "+ Novo" do painel: /negocio/clientes?novo=1 já cai no formulário.
  // Tem de ser efeito: ler a URL durante o render divergiria do HTML do servidor
  // e quebraria a hidratação.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abertura única no mount, vinda da URL
    setDrawerOpen(true);
  }, []);

  const filtered = clients.filter((c) => {
    const q = query.toLowerCase();
    const matchQ =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.instagram?.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || c.status === statusFilter;
    return matchQ && matchS;
  });

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(c: ClienteListaItem) {
    setEditingId(c.id);
    setForm({
      name: c.name, email: c.email || "", phone: c.phone || "", instagram: c.instagram || "",
      company: c.company || "", notes: c.notes || "", status: c.status,
      source: c.source || "", tags: c.tags || "",
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function recarregar() {
    const r = await fetch("/api/clients");
    if (r.ok) setClients(await r.json());
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/clients/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      await recarregar();
      closeDrawer();
    } finally {
      setSaving(false);
    }
  }

  async function alterarStatus(c: ClienteListaItem, novo: string) {
    setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: novo } : x)));
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    recarregar();
  }

  async function arquivar(c: ClienteListaItem) {
    const arquivando = !c.arquivadoEm;
    if (arquivando && !confirm(`Arquivar ${c.name}? O histórico é preservado e ele sai da lista.`)) return;
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arquivadoEm: arquivando ? new Date().toISOString() : null }),
    });
    recarregar();
  }

  async function excluir(c: ClienteListaItem) {
    if (!confirm(`Excluir ${c.name} definitivamente? As interações registradas são apagadas junto.`)) return;
    await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
    setClients((prev) => prev.filter((x) => x.id !== c.id));
  }

  const colunas = ["Cliente", "Status", "Saúde", "Receita", "Último contato", "Próxima ação"];

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Clientes</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {clients.length} contato{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface-2/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground-2 transition-all duration-150 hover:border-brand/35 hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" /> Novo cliente
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, empresa, e-mail, telefone…"
            className="w-full rounded-[9px] border border-border bg-surface py-1.5 pl-8 pr-3 text-[12px] outline-none transition-colors duration-150 placeholder:text-muted-2 focus:border-brand/50"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "lead", "active", "inactive", "lost"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45 ${
                statusFilter === s
                  ? "bg-foreground text-background"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {s === "all" ? "Todos" : labelStatus(s)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[12px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-baseline gap-2 border-t border-border-subtle py-3">
          <span className="text-[12px] font-medium text-foreground-2">
            {clients.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado"}
          </span>
          <button
            onClick={openNew}
            className="text-[12px] text-brand transition-colors duration-150 hover:text-foreground focus-visible:outline-none"
          >
            {clients.length === 0 ? "+ Adicionar o primeiro" : "Limpe os filtros ou crie um novo"}
          </button>
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-border-subtle">
                {colunas.map((col) => (
                  <th
                    key={col}
                    className="px-2 pb-1.5 text-left text-[10px] font-medium uppercase tracking-[0.09em] text-muted-2"
                  >
                    {col}
                  </th>
                ))}
                <th className="w-8 px-2 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const receita = textoReceita(c);
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/negocio/clientes/${c.id}`)}
                    className="group cursor-pointer border-b border-border-subtle/70 transition-colors duration-150 hover:bg-surface-2/40"
                  >
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={c.name} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-foreground">{c.name}</p>
                          {(c.company || c.email) && (
                            <p className="truncate text-[11px] text-muted">{c.company || c.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-2 py-2">
                      <SaudeIndicator status={c.saude} motivo={c.saudeResumo} compacto />
                    </td>
                    <td className="px-2 py-2">
                      {receita ? (
                        <span className="whitespace-nowrap text-[12px] tabular-nums text-foreground-2">
                          {receita.valor}
                          {receita.sufixo && <span className="text-muted-2">{receita.sufixo}</span>}
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-2">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className="whitespace-nowrap text-[12px] text-muted">
                        {fmtDataHumana(c.ultimoContatoEm)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {c.proximaAcao ? (
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          <span className="truncate text-[12px] text-foreground-2">
                            {c.proximaAcao.titulo}
                          </span>
                          <span
                            className={`whitespace-nowrap text-[11px] ${
                              c.proximaAcao.atrasado ? "text-[color:var(--danger)]" : "text-muted-2"
                            }`}
                          >
                            · {c.proximaAcao.quando}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-2">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                        <RowMenu
                          status={c.status}
                          arquivado={Boolean(c.arquivadoEm)}
                          onEditar={() => openEdit(c)}
                          onStatus={(novo) => alterarStatus(c, novo)}
                          onArquivar={() => arquivar(c)}
                          onExcluir={() => excluir(c)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer novo/editar */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">{editingId ? "Editar cliente" : "Novo cliente"}</h2>
              <button onClick={closeDrawer} className="rounded-lg p-1.5 text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {[
                { key: "name", label: "Nome *", placeholder: "Nome completo" },
                { key: "company", label: "Empresa", placeholder: "Nome da empresa" },
                { key: "phone", label: "Telefone / WhatsApp", placeholder: "(11) 99999-9999" },
                { key: "email", label: "E-mail", placeholder: "email@exemplo.com" },
                { key: "instagram", label: "Instagram", placeholder: "@usuario" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted">{label}</label>
                  <input
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Status</label>
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 pr-8 text-sm outline-none focus:border-brand"
                  >
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
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 pr-8 text-sm outline-none focus:border-brand"
                  >
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
                <input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="vip, parceiro, interessado"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
                />
                <p className="text-xs text-muted">Separe por vírgula</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Anotações sobre o cliente…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t border-border px-6 py-4">
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="brand-gradient inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "Salvar" : "Criar cliente"}
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
    </div>
  );
}
