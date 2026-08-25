"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_DESPESA_LABELS,
  LINHAS,
  LINHA_LABELS,
  STATUS_ESCOLHIVEIS,
  STATUS_GRAVADO_LABELS,
  TIPOS,
  TIPO_LABELS,
} from "@/lib/financeiro";

/**
 * Formulários do Financeiro.
 *
 * Progressive disclosure: o caminho normal é descrição, valor, tipo, linha e
 * cliente — cinco campos. Competência, vencimento e status têm padrão sensato e
 * só aparecem quando você pede. Um formulário de quinze campos abertos faz o
 * lançamento de uma mensalidade parecer uma obrigação fiscal.
 */

export interface FormReceita {
  descricao: string;
  valor: string;
  linha: string;
  tipo: string;
  status: string;
  competencia: string;
  vencimento: string;
  clienteId: string;
}

export interface FormDespesa {
  descricao: string;
  valor: string;
  categoria: string;
  recorrente: boolean;
  competencia: string;
}

// ─── Primitivas ──────────────────────────────────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="premium-input appearance-none pr-8"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/** Escolha binária como segmento, não como dropdown: são só duas opções. */
function Segmento({
  opcoes,
  value,
  onChange,
}: {
  opcoes: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[10px] border border-border bg-surface-2/60 p-1">
      {opcoes.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
            value === o.key
              ? "bg-brand/15 text-brand"
              : "text-muted hover:text-foreground-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Painel({
  titulo,
  onFechar,
  children,
  rodape,
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  rodape: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onFechar} />
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col"
        style={{ background: "var(--background)", borderLeft: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">{titulo}</h2>
          <button
            onClick={onFechar}
            className="rounded-lg p-1 text-muted transition-colors duration-150 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex gap-2 border-t border-border px-5 py-3.5">{rodape}</div>
      </div>
    </>
  );
}

// ─── Receita ─────────────────────────────────────────────────────────────────

export function DrawerReceita({
  form,
  setForm,
  clientes,
  editando,
  salvando,
  onSalvar,
  onFechar,
}: {
  form: FormReceita;
  setForm: (f: (prev: FormReceita) => FormReceita) => void;
  clientes: { id: string; name: string }[];
  editando: boolean;
  salvando: boolean;
  onSalvar: () => void;
  onFechar: () => void;
}) {
  // Ao editar, os detalhes já vêm abertos: você veio mexer justamente neles.
  const [detalhes, setDetalhes] = useState(editando);

  const recorrente = form.tipo === "RECORRENTE";
  const valido = form.descricao.trim().length > 0 && form.valor.trim().length > 0;

  return (
    <Painel
      titulo={editando ? "Editar receita" : "Nova receita"}
      onFechar={onFechar}
      rodape={
        <>
          <button
            onClick={onSalvar}
            disabled={salvando || !valido}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {editando ? "Salvar" : "Criar receita"}
          </button>
          <button onClick={onFechar} className="btn-secondary">
            Cancelar
          </button>
        </>
      }
    >
      <Campo label="Descrição">
        <input
          autoFocus
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          placeholder="Ex: CRM — Mantegaria"
          className="premium-input"
        />
      </Campo>

      <Campo label="Valor (R$)">
        <input
          value={form.valor}
          onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          placeholder="1.500,00"
          inputMode="decimal"
          className="premium-input"
        />
      </Campo>

      <Campo label="Tipo">
        <Segmento
          opcoes={TIPOS.map((t) => ({ key: t, label: TIPO_LABELS[t] }))}
          value={form.tipo}
          onChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
        />
      </Campo>

      <Campo label="Linha de negócio">
        <Select value={form.linha} onChange={(v) => setForm((f) => ({ ...f, linha: v }))}>
          {LINHAS.map((l) => (
            <option key={l} value={l}>
              {LINHA_LABELS[l]}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo label="Cliente">
        <Select value={form.clienteId} onChange={(v) => setForm((f) => ({ ...f, clienteId: v }))}>
          <option value="">Sem vínculo</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Campo>

      {!detalhes ? (
        <button
          onClick={() => setDetalhes(true)}
          className="text-[12px] text-brand transition-colors duration-150 hover:text-foreground"
        >
          Ajustar competência, vencimento e status
        </button>
      ) : (
        <div className="space-y-4 border-t border-border-subtle pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label={recorrente ? "Início (competência)" : "Competência"}>
              <input
                type="month"
                value={form.competencia}
                onChange={(e) => setForm((f) => ({ ...f, competencia: e.target.value }))}
                className="premium-input"
                style={{ colorScheme: "dark" }}
              />
            </Campo>
            <Campo label="Vencimento">
              <input
                type="date"
                value={form.vencimento}
                onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))}
                className="premium-input"
                style={{ colorScheme: "dark" }}
              />
            </Campo>
          </div>

          <Campo label="Status">
            <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              {STATUS_ESCOLHIVEIS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_GRAVADO_LABELS[s]}
                </option>
              ))}
            </Select>
          </Campo>

          <p className="text-[11px] leading-relaxed text-muted-2">
            {recorrente
              ? "Recorrente entra no MRR do mês. Cada mês seguinte é lançado pela ação “lançar recorrentes” — sem recadastro manual e sem duplicar."
              : "Pontual não entra no MRR."}{" "}
            “Vencida” não é escolhida aqui: é derivada do vencimento.
          </p>
        </div>
      )}
    </Painel>
  );
}

// ─── Despesa ─────────────────────────────────────────────────────────────────

export function DrawerDespesa({
  form,
  setForm,
  salvando,
  onSalvar,
  onFechar,
}: {
  form: FormDespesa;
  setForm: (f: (prev: FormDespesa) => FormDespesa) => void;
  salvando: boolean;
  onSalvar: () => void;
  onFechar: () => void;
}) {
  const valido = form.descricao.trim().length > 0 && form.valor.trim().length > 0;

  return (
    <Painel
      titulo="Nova despesa"
      onFechar={onFechar}
      rodape={
        <>
          <button
            onClick={onSalvar}
            disabled={salvando || !valido}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Lançar despesa
          </button>
          <button onClick={onFechar} className="btn-secondary">
            Cancelar
          </button>
        </>
      }
    >
      <Campo label="Descrição">
        <input
          autoFocus
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          placeholder="Ex: Vercel, contador, tráfego"
          className="premium-input"
        />
      </Campo>

      <Campo label="Valor (R$)">
        <input
          value={form.valor}
          onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          placeholder="199,00"
          inputMode="decimal"
          className="premium-input"
        />
      </Campo>

      <Campo label="Categoria">
        <Select value={form.categoria} onChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
          {CATEGORIAS_DESPESA.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_DESPESA_LABELS[c]}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo label="Competência">
        <input
          type="month"
          value={form.competencia}
          onChange={(e) => setForm((f) => ({ ...f, competencia: e.target.value }))}
          className="premium-input"
          style={{ colorScheme: "dark" }}
        />
      </Campo>

      <label className="flex cursor-pointer items-center gap-2.5 pt-1">
        <input
          type="checkbox"
          checked={form.recorrente}
          onChange={(e) => setForm((f) => ({ ...f, recorrente: e.target.checked }))}
          className="h-3.5 w-3.5 accent-[color:var(--brand)]"
        />
        <span className="text-[12px] text-foreground-2">Despesa fixa (se repete todo mês)</span>
      </label>

      <p className="text-[11px] leading-relaxed text-muted-2">
        As despesas alimentam o burn médio dos últimos 3 meses, que é o que torna o
        Runway calculável.
      </p>
    </Painel>
  );
}
