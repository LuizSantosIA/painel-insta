"use client";

import Link from "next/link";
import {
  CATEGORIA_DESPESA_LABELS,
  LINHA_LABELS,
  STATUS_LABELS,
  TIPO_LABELS,
  diasEmAtraso,
  fmtBRL,
  fmtDiaMes,
  statusEfetivo,
  vencimentoEfetivo,
  type ClienteReceita,
  type LinhaResumo,
  type StatusEfetivo,
} from "@/lib/financeiro";
import type { DespesaDTO } from "@/app/api/financeiro/overview/route";
import type { ReceitaDTO } from "@/lib/financeiro-server";
import { Dot, EmptyLine, LINHA_HOVER, Section, SectionHeader, TRACO, type Tom } from "@/components/negocio/panel";

/**
 * Blocos da tela de Financeiro.
 *
 * Seguem a mesma régua visual do painel de /negocio: seções sem caixa, separadas
 * por régua de cabeçalho, números tabulares e cor só onde ela significa alguma
 * coisa. Nenhuma regra de dinheiro nasce aqui — tudo vem de financeiro.ts.
 */

/** Cada status tem um tom semântico. Vencida é a única que grita. */
const TOM_STATUS: Record<StatusEfetivo, Tom> = {
  RECEBIDA: "OK",
  A_RECEBER: "NEUTRO",
  PREVISTA: "NEUTRO",
  VENCIDA: "URGENTE",
  CANCELADA: "NEUTRO",
};

export function StatusReceita({ status }: { status: StatusEfetivo }) {
  const cor = {
    RECEBIDA: "text-[color:var(--success)]",
    VENCIDA: "text-[color:var(--danger)]",
    A_RECEBER: "text-foreground-2",
    PREVISTA: "text-muted",
    CANCELADA: "text-muted-2 line-through",
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] ${cor}`}>
      <Dot tom={TOM_STATUS[status]} />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Receita por linha de negócio ────────────────────────────────────────────

/**
 * Quanto cada linha representa. Barras simples em vez de um segundo gráfico:
 * a comparação é entre três valores, e três barras dizem isso melhor que um
 * donut — e ocupam a metade do espaço.
 */
export function ReceitaPorLinha({ linhas }: { linhas: LinhaResumo[] }) {
  const total = linhas.reduce((s, l) => s + l.totalCentavos, 0);
  const maior = Math.max(...linhas.map((l) => l.totalCentavos), 1);

  return (
    <Section>
      <SectionHeader
        titulo="Por linha de negócio"
        meta={total > 0 ? fmtBRL(total) : undefined}
      />

      {total === 0 ? (
        <EmptyLine titulo="Sem receita no mês." descricao="Nada para distribuir ainda." />
      ) : (
        <div className="space-y-2.5 pt-2.5">
          {linhas.map((l) => (
            <div key={l.linha} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] text-foreground-2">{l.label}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-[11px] tabular-nums text-muted-2">{l.percentual}%</span>
                  <span
                    className={`text-[13px] font-semibold tabular-nums ${
                      l.totalCentavos > 0 ? "text-foreground" : "text-muted-2"
                    }`}
                  >
                    {l.totalCentavos > 0 ? fmtBRL(l.totalCentavos) : TRACO}
                  </span>
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.round((l.totalCentavos / maior) * 100)}%`,
                    background: l.cor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Principais clientes ─────────────────────────────────────────────────────

/**
 * Quem gera a receita do mês. Só aparece com dado útil — e cada linha leva ao
 * perfil 360°, porque a pergunta seguinte é sempre sobre o cliente, não sobre a
 * receita.
 */
export function PrincipaisClientes({ clientes }: { clientes: ClienteReceita[] }) {
  if (clientes.length === 0) return null;

  return (
    <Section>
      <SectionHeader titulo="Principais clientes" meta={`${clientes.length} no mês`} />

      <div className="divide-y divide-border-subtle/70">
        {clientes.map((c) => (
          <Link
            key={c.clienteId}
            href={`/negocio/clientes/${c.clienteId}`}
            className={`flex items-baseline justify-between gap-3 py-[7px] ${LINHA_HOVER}`}
          >
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2">{c.nome}</span>
            {c.vencidoCentavos > 0 && (
              <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--danger)]">
                {fmtBRL(c.vencidoCentavos)} vencidos
              </span>
            )}
            {c.mrrCentavos > 0 && c.vencidoCentavos === 0 && (
              <span className="shrink-0 text-[11px] tabular-nums text-muted-2">
                {fmtBRL(c.mrrCentavos)}/mês
              </span>
            )}
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
              {fmtBRL(c.totalCentavos)}
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ─── Cobrança ────────────────────────────────────────────────────────────────

/**
 * O que está atrasado, de qualquer competência.
 *
 * Fica fora da tabela do mês de propósito: uma cobrança de junho não pode sumir
 * porque você navegou para agosto. É a mesma lista que alimenta "Precisa da sua
 * atenção" no painel e o sinal financeiro da engine de Saúde.
 */
export function Vencidas({
  receitas,
  onReceber,
  recebendoId,
}: {
  receitas: ReceitaDTO[];
  onReceber: (id: string) => void;
  recebendoId: string | null;
}) {
  if (receitas.length === 0) return null;

  const total = receitas.reduce((s, r) => s + r.valorCentavos, 0);

  return (
    <Section>
      <SectionHeader
        titulo="Vencidas"
        meta={
          <span className="text-[color:var(--danger)]">
            {fmtBRL(total)} · {receitas.length} {receitas.length === 1 ? "cobrança" : "cobranças"}
          </span>
        }
      />

      <div className="divide-y divide-border-subtle/70">
        {receitas.map((r) => {
          const dias = diasEmAtraso(r);
          return (
            <div key={r.id} className={`flex items-center gap-3 py-[7px] ${LINHA_HOVER}`}>
              <Dot tom="URGENTE" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-foreground-2">{r.descricao}</p>
                {r.clienteNome && (
                  <Link
                    href={`/negocio/clientes/${r.clienteId}`}
                    className="text-[11px] text-muted transition-colors duration-150 hover:text-brand"
                  >
                    {r.clienteNome}
                  </Link>
                )}
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--danger)]">
                {dias === 1 ? "há 1 dia" : `há ${dias} dias`}
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                {fmtBRL(r.valorCentavos)}
              </span>
              <button
                onClick={() => onReceber(r.id)}
                disabled={recebendoId === r.id}
                className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:border-[color:var(--success)]/40 hover:text-[color:var(--success)] disabled:opacity-50"
              >
                {recebendoId === r.id ? "…" : "Recebi"}
              </button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Tabela de receitas ──────────────────────────────────────────────────────

export function TabelaReceitas({
  receitas,
  onEditar,
  onExcluir,
  onReceber,
  recebendoId,
}: {
  receitas: ReceitaDTO[];
  onEditar: (r: ReceitaDTO) => void;
  onExcluir: (id: string) => void;
  onReceber: (id: string) => void;
  recebendoId: string | null;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border-subtle">
            {["Descrição", "Cliente", "Linha", "Tipo", "Vencimento", "Status", "Valor", ""].map(
              (h, i) => (
                <th
                  key={h || i}
                  className={`py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-2 ${
                    i >= 6 ? "text-right" : "text-left"
                  } ${i === 0 ? "pl-1" : "px-2"}`}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle/70">
          {receitas.map((r) => {
            const status = statusEfetivo(r);
            const venc = vencimentoEfetivo(r);
            const cancelada = status === "CANCELADA";

            return (
              <tr key={r.id} className="group transition-colors duration-150 hover:bg-surface-2/40">
                <td className="py-[9px] pl-1 pr-2">
                  <span
                    className={`text-[12px] ${
                      cancelada ? "text-muted-2 line-through" : "text-foreground-2"
                    }`}
                  >
                    {r.descricao}
                  </span>
                </td>
                <td className="px-2 py-[9px]">
                  {r.clienteId ? (
                    <Link
                      href={`/negocio/clientes/${r.clienteId}`}
                      className="text-[12px] text-muted transition-colors duration-150 hover:text-brand"
                    >
                      {r.clienteNome}
                    </Link>
                  ) : (
                    <span className="text-[12px] text-muted-2">{TRACO}</span>
                  )}
                </td>
                <td className="px-2 py-[9px]">
                  <span className="text-[12px] text-muted">
                    {LINHA_LABELS[r.linha] ?? r.linha}
                  </span>
                </td>
                <td className="px-2 py-[9px]">
                  <span className="text-[12px] text-muted">{TIPO_LABELS[r.tipo] ?? r.tipo}</span>
                </td>
                <td className="px-2 py-[9px]">
                  <span
                    className={`text-[12px] tabular-nums ${
                      status === "VENCIDA" ? "text-[color:var(--danger)]" : "text-muted"
                    }`}
                  >
                    {venc ? fmtDiaMes(venc) : TRACO}
                  </span>
                </td>
                <td className="px-2 py-[9px]">
                  <StatusReceita status={status} />
                </td>
                <td className="px-2 py-[9px] text-right">
                  <span
                    className={`text-[13px] font-semibold tabular-nums ${
                      cancelada ? "text-muted-2" : "text-foreground"
                    }`}
                  >
                    {fmtBRL(r.valorCentavos)}
                  </span>
                </td>
                <td className="py-[9px] pl-2 text-right">
                  {/* As ações só aparecem no hover: a linha é sobre o dinheiro. */}
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                    {status !== "RECEBIDA" && status !== "CANCELADA" && (
                      <button
                        onClick={() => onReceber(r.id)}
                        disabled={recebendoId === r.id}
                        title="Marcar como recebida"
                        className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:border-[color:var(--success)]/40 hover:text-[color:var(--success)] disabled:opacity-50"
                      >
                        {recebendoId === r.id ? "…" : "Recebi"}
                      </button>
                    )}
                    <button
                      onClick={() => onEditar(r)}
                      title="Editar"
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:text-foreground"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onExcluir(r.id)}
                      title="Excluir"
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:text-[color:var(--danger)]"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Despesas ────────────────────────────────────────────────────────────────

/**
 * Despesas do mês — o que falta para o Runway existir.
 *
 * Registro simples de propósito: descrição, categoria e valor. Não há rateio,
 * competência de pagamento nem centro de custo; isso é contabilidade, e o
 * Financeiro aqui existe para responder "quanto tempo o caixa aguenta".
 */
export function Despesas({
  despesas,
  totalCentavos,
  onNova,
  onExcluir,
}: {
  despesas: DespesaDTO[];
  totalCentavos: number;
  onNova: () => void;
  onExcluir: (id: string) => void;
}) {
  return (
    <Section>
      <SectionHeader
        titulo="Despesas do mês"
        meta={totalCentavos > 0 ? fmtBRL(totalCentavos) : undefined}
      />

      {despesas.length === 0 ? (
        <div className="flex items-baseline gap-2 py-2.5">
          <span className="text-[12px] text-muted">Nenhuma despesa lançada.</span>
          <button
            onClick={onNova}
            className="text-[12px] text-brand transition-colors duration-150 hover:text-foreground"
          >
            + Adicionar despesa
          </button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border-subtle/70">
            {despesas.map((d) => (
              <div key={d.id} className={`group flex items-baseline gap-3 py-[7px] ${LINHA_HOVER}`}>
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2">
                  {d.descricao}
                </span>
                <span className="shrink-0 text-[11px] text-muted-2">
                  {CATEGORIA_DESPESA_LABELS[d.categoria] ?? d.categoria}
                </span>
                {d.recorrente && (
                  <span className="shrink-0 text-[11px] text-muted-2">fixa</span>
                )}
                <span className="shrink-0 text-[12px] tabular-nums text-foreground-2">
                  {fmtBRL(d.valorCentavos)}
                </span>
                <button
                  onClick={() => onExcluir(d.id)}
                  className="shrink-0 text-[11px] text-muted-2 opacity-0 transition-opacity duration-150 hover:text-[color:var(--danger)] group-hover:opacity-100"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={onNova}
            className="mt-2 text-[12px] text-brand transition-colors duration-150 hover:text-foreground"
          >
            + Adicionar despesa
          </button>
        </>
      )}
    </Section>
  );
}
