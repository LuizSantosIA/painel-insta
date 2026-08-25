import Link from "next/link";
import { fmtBRL } from "@/lib/financeiro";
import { labelEstagio } from "@/lib/pipeline";
import { statusEfetivo, STATUS_LABELS } from "@/lib/financeiro";
import {
  fmtDataHumana,
  fmtPrazoCurto,
  ultimosPagamentos,
  type CompromissoCliente,
  type LeadCliente,
  type MetricasCliente,
  type ReceitaCliente,
  type TarefaCliente,
} from "@/lib/cliente-360";
import { LINHA_HOVER, Section, SectionHeader } from "@/components/negocio/panel";

/**
 * Blocos de contexto da coluna lateral.
 *
 * Todos leem os mesmos registros das outras áreas — uma receita aqui é a mesma
 * linha do Financeiro, uma oportunidade é a mesma do Pipeline. Nada é duplicado.
 */

/** Rótulo do status como o Financeiro o mostra — inclusive "vencida", derivada. */
function rotuloStatus(r: ReceitaCliente): string {
  return STATUS_LABELS[statusEfetivo(r)].toLowerCase();
}

export function ProximasAcoes({
  tarefas,
  compromissos,
  onNovaTarefa,
}: {
  tarefas: TarefaCliente[];
  compromissos: CompromissoCliente[];
  onNovaTarefa: () => void;
}) {
  const abertas = tarefas.filter((t) => !t.done);
  const pendentes = compromissos.filter((c) => !c.cumprido);
  const total = abertas.length + pendentes.length;

  return (
    <Section>
      <SectionHeader titulo="Próximas ações" meta={total > 0 ? `${total} em aberto` : undefined} />

      {total === 0 ? (
        <div className="flex items-baseline gap-2 py-2.5">
          <span className="text-[12px] text-muted">Nada pendente.</span>
          <button
            onClick={onNovaTarefa}
            className="text-[12px] text-brand transition-colors duration-150 hover:text-foreground focus-visible:outline-none"
          >
            + Criar tarefa
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle/70">
          {abertas.map((t) => (
            <Link key={t.id} href="/negocio/tarefas" className={`flex items-center gap-2 py-[7px] ${LINHA_HOVER}`}>
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2">{t.title}</span>
              <span className="shrink-0 text-[11px] text-muted-2">
                {t.dueDate ? fmtPrazoCurto(t.dueDate) : "sem prazo"}
              </span>
            </Link>
          ))}
          {pendentes.map((c) => (
            <Link
              key={c.id}
              href="/negocio/compromissos"
              className={`flex items-center gap-2 py-[7px] ${LINHA_HOVER}`}
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2">{c.descricao}</span>
              <span className="shrink-0 text-[11px] text-muted-2">{fmtPrazoCurto(c.prazoEm)}</span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

export function FinanceiroCliente({
  metricas,
  receitas,
  clienteId,
}: {
  metricas: MetricasCliente;
  receitas: ReceitaCliente[];
  clienteId: string;
}) {
  const recentes = receitas.slice(0, 4);
  const pagamentos = ultimosPagamentos(receitas, 3);

  return (
    <Section>
      <SectionHeader titulo="Financeiro" href="/negocio/financeiro" hrefLabel="Abrir" />

      {receitas.length === 0 ? (
        <div className="flex items-baseline gap-2 py-2.5">
          <span className="text-[12px] text-muted">Nenhuma receita.</span>
          <Link
            href={`/negocio/financeiro?novo=1&cliente=${clienteId}`}
            className="text-[12px] text-brand transition-colors duration-150 hover:text-foreground"
          >
            + Lançar receita
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 py-2">
            <span className="text-[12px] text-muted">
              MRR{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {metricas.mrrCentavos > 0 ? fmtBRL(metricas.mrrCentavos) : "—"}
              </span>
            </span>
            <span className="text-[12px] text-muted">
              A receber{" "}
              <span
                className={`font-semibold tabular-nums ${
                  metricas.aReceberCentavos > 0 ? "text-[color:var(--warning)]" : "text-muted-2"
                }`}
              >
                {metricas.aReceberCentavos > 0 ? fmtBRL(metricas.aReceberCentavos) : "—"}
              </span>
            </span>
            {metricas.vencidoCentavos > 0 && (
              <span className="text-[12px] text-muted">
                Vencido{" "}
                <span className="font-semibold tabular-nums text-[color:var(--danger)]">
                  {fmtBRL(metricas.vencidoCentavos)}
                </span>
              </span>
            )}
          </div>

          <div className="divide-y divide-border-subtle/70 border-t border-border-subtle/70">
            {recentes.map((r) => {
              const status = statusEfetivo(r);
              return (
                <div key={r.id} className="flex items-baseline gap-2 py-[7px]">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2">
                    {r.descricao}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-wide ${
                      status === "VENCIDA" ? "text-[color:var(--danger)]" : "text-muted-2"
                    }`}
                  >
                    {rotuloStatus(r)}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-foreground">
                    {fmtBRL(r.valorCentavos)}
                  </span>
                </div>
              );
            })}
          </div>

          {pagamentos.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-muted-2">
                Últimos pagamentos
              </p>
              <div className="pt-1">
                {pagamentos.map((p) => (
                  <div key={p.id} className="flex items-baseline gap-2 py-[3px]">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                      {p.descricao}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-2">
                      {fmtDataHumana(p.dataRecebida)}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--success)]">
                      {fmtBRL(p.valorCentavos)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

const ESTAGIOS_ABERTOS = ["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO"];

export function PipelineCliente({ leads, clienteId }: { leads: LeadCliente[]; clienteId: string }) {
  const abertos = leads.filter((l) => ESTAGIOS_ABERTOS.includes(l.estagio));

  return (
    <Section>
      <SectionHeader titulo="Pipeline" href="/negocio/pipeline" hrefLabel="Abrir" />

      {leads.length === 0 ? (
        <div className="flex items-baseline gap-2 py-2.5">
          <span className="text-[12px] text-muted">Nenhuma oportunidade.</span>
          <Link
            href={`/negocio/pipeline?novo=1&cliente=${clienteId}`}
            className="text-[12px] text-brand transition-colors duration-150 hover:text-foreground"
          >
            + Criar oportunidade
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle/70">
          {leads.map((l) => {
            const aberto = abertos.includes(l);
            return (
              <Link key={l.id} href="/negocio/pipeline" className={`flex items-center gap-2 py-[7px] ${LINHA_HOVER}`}>
                <span
                  className={`min-w-0 flex-1 truncate text-[12px] ${
                    aberto ? "text-foreground-2" : "text-muted-2 line-through"
                  }`}
                >
                  {l.nome}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-2">
                  {labelEstagio(l.estagio)}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-foreground-2">
                  {l.valorEstimadoCentavos ? fmtBRL(l.valorEstimadoCentavos) : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/** Bloco de contato do cabeçalho — só mostra o que existe. */
export function DadosContato({
  email,
  phone,
  instagram,
  company,
  criadoEm,
  ultimoContatoEm,
}: {
  email: string | null;
  phone: string | null;
  instagram: string | null;
  company: string | null;
  criadoEm: string;
  ultimoContatoEm: string | null;
}) {
  const campos: { label: string; valor: string }[] = [];
  if (company) campos.push({ label: "Empresa", valor: company });
  if (email) campos.push({ label: "E-mail", valor: email });
  if (phone) campos.push({ label: "Telefone", valor: phone });
  if (instagram) campos.push({ label: "Instagram", valor: instagram });
  campos.push({ label: "Cadastrado", valor: fmtDataHumana(criadoEm) });
  if (ultimoContatoEm) campos.push({ label: "Último contato", valor: fmtDataHumana(ultimoContatoEm) });

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {campos.map((c) => (
        <span key={c.label} className="text-[11px] text-muted-2">
          {c.label} <span className="text-foreground-2">{c.valor}</span>
        </span>
      ))}
    </div>
  );
}
