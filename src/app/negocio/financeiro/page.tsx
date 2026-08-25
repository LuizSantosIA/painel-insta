"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Pencil, Plus, X } from "lucide-react";
import {
  dicaRunway,
  fmtBRL,
  fmtDataInput,
  fmtVariacao,
  mesPorExtenso,
  parseBRL,
  ultimoDiaDoMes,
  type ResumoFinanceiro,
} from "@/lib/financeiro";
import type { FinanceiroOverview } from "@/app/api/financeiro/overview/route";
import type { ReceitaDTO } from "@/lib/financeiro-server";
import { ReceitaEvolucaoChart, type ComposicaoGrafico } from "@/components/charts";
import { MetricStrip, type BusinessMetricProps } from "@/components/negocio/metric-strip";
import { EmptyLine, Section, SectionHeader } from "@/components/negocio/panel";
import {
  Despesas,
  PrincipaisClientes,
  ReceitaPorLinha,
  TabelaReceitas,
  Vencidas,
} from "@/components/financeiro/blocos";
import {
  DrawerDespesa,
  DrawerReceita,
  type FormDespesa,
  type FormReceita,
} from "@/components/financeiro/drawer";

type Cliente = { id: string; name: string };

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function formVazio(mes: string): FormReceita {
  return {
    descricao: "",
    valor: "",
    linha: "INNOBI",
    tipo: "RECORRENTE",
    // O padrão é "a receber": lançar uma receita é registrar dinheiro combinado,
    // não uma hipótese. Quem quiser previsão troca em "ajustar".
    status: "CONFIRMADA",
    competencia: mes,
    vencimento: fmtDataInput(ultimoDiaDoMes(`${mes}-01`)),
    clienteId: "",
  };
}

function despesaVazia(mes: string): FormDespesa {
  return { descricao: "", valor: "", categoria: "FERRAMENTAS", recorrente: false, competencia: mes };
}

/**
 * Faixa executiva.
 *
 * Quatro números e nada mais: quanto entra por mês de forma recorrente, quanto já
 * entrou, quanto falta entrar e por quanto tempo o caixa aguenta. A linha auxiliar
 * de cada um responde a pergunta imediata seguinte — e quando não há dado, explica
 * a ausência em vez de mostrar zero.
 */
function montarMetricas(resumo: ResumoFinanceiro, ehMesCorrente: boolean): BusinessMetricProps[] {
  const variacao = resumo.mrrVariacao;

  return [
    {
      label: ehMesCorrente ? "MRR atual" : "MRR do mês",
      valor: resumo.mrrAtual > 0 ? fmtBRL(resumo.mrrAtual) : null,
      auxiliar:
        variacao !== null
          ? `${fmtVariacao(variacao)} vs. mês anterior`
          : resumo.mrrAnterior === 0
            ? "sem histórico anterior"
            : "sem base de comparação",
      tomAuxiliar: variacao === null ? "neutro" : variacao >= 0 ? "positivo" : "negativo",
      vazioDica: "nenhuma receita recorrente no mês",
    },
    {
      label: "Recebido no mês",
      valor: resumo.recebido > 0 ? fmtBRL(resumo.recebido) : null,
      auxiliar:
        resumo.recebidoPontual > 0
          ? `${fmtBRL(resumo.recebidoPontual)} pontual`
          : "todo recorrente",
      vazioDica: "nada entrou ainda neste mês",
    },
    {
      label: "A receber",
      valor: resumo.aReceber > 0 ? fmtBRL(resumo.aReceber) : null,
      auxiliar:
        resumo.vencido > 0
          ? `${fmtBRL(resumo.vencido)} vencidos`
          : resumo.aVencer7Dias > 0
            ? `${fmtBRL(resumo.aVencer7Dias)} nos próximos 7 dias`
            : "nada vencido",
      tomAuxiliar: resumo.vencido > 0 ? "negativo" : "positivo",
      vazioDica: "nenhuma receita em aberto",
    },
    {
      label: "Runway",
      valor:
        resumo.runway !== null
          ? `${resumo.runway} ${resumo.runway === 1 ? "mês" : "meses"}`
          : null,
      auxiliar: dicaRunway({
        meses: resumo.runway,
        motivo: resumo.runwayMotivo,
        burnMedioCentavos: resumo.burnMedioCentavos,
      }),
      tomAuxiliar: resumo.runway !== null && resumo.runway <= 3 ? "negativo" : "neutro",
      vazioDica:
        resumo.runwayMotivo === "SEM_DESPESAS"
          ? "adicione despesas para calcular"
          : "informe o saldo em caixa",
    },
  ];
}

export default function FinanceiroPage() {
  const [mes, setMes] = useState(mesAtual);
  const [dados, setDados] = useState<FinanceiroOverview | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const [composicao, setComposicao] = useState<ComposicaoGrafico>("LINHA");
  const [recebendoId, setRecebendoId] = useState<string | null>(null);
  const [replicando, setReplicando] = useState(false);

  // Drawers
  const [receitaAberta, setReceitaAberta] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formReceita, setFormReceita] = useState<FormReceita>(() => formVazio(mesAtual()));
  const [salvandoReceita, setSalvandoReceita] = useState(false);

  const [despesaAberta, setDespesaAberta] = useState(false);
  const [formDespesa, setFormDespesa] = useState<FormDespesa>(() => despesaVazia(mesAtual()));
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);

  // Saldo em caixa — editável inline, é o outro lado do runway
  const [saldoEdit, setSaldoEdit] = useState(false);
  const [saldoInput, setSaldoInput] = useState("");

  /**
   * Nenhum setState antes do primeiro await: chamada de dentro de um efeito, a
   * marcação de "carregando" síncrona dispararia um render em cascata. Quem
   * acende o indicador ao trocar de mês é o próprio onChange do seletor.
   */
  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/financeiro/overview?mes=${mes}`);
      if (!res.ok) throw new Error("falha");
      setDados(await res.json());
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => {});
  }, []);

  // Aberto pelo "+ Novo" do painel ou pelo perfil 360°: ?novo=1&cliente=<id>.
  // Tem de ser efeito: ler a URL durante o render divergiria do HTML do servidor.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("novo") !== "1") return;
    const cliente = params.get("cliente");
    /* eslint-disable react-hooks/set-state-in-effect -- abertura única no mount, vinda da URL */
    setFormReceita({ ...formVazio(mesAtual()), clienteId: cliente ?? "" });
    setReceitaAberta(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // ─── Ações ────────────────────────────────────────────────────────────────

  function abrirNova() {
    setEditandoId(null);
    setFormReceita(formVazio(mes));
    setReceitaAberta(true);
  }

  function abrirEdicao(r: ReceitaDTO) {
    setEditandoId(r.id);
    setFormReceita({
      descricao: r.descricao,
      valor: (r.valorCentavos / 100).toFixed(2).replace(".", ","),
      linha: r.linha,
      tipo: r.tipo,
      status: r.status,
      competencia: r.competencia.slice(0, 7),
      vencimento: r.vencimento ? fmtDataInput(r.vencimento) : "",
      clienteId: r.clienteId ?? "",
    });
    setReceitaAberta(true);
  }

  async function salvarReceita() {
    setSalvandoReceita(true);
    try {
      const corpo = {
        descricao: formReceita.descricao.trim(),
        valorCentavos: parseBRL(formReceita.valor),
        linha: formReceita.linha,
        tipo: formReceita.tipo,
        status: formReceita.status,
        competencia: formReceita.competencia,
        vencimento: formReceita.vencimento || null,
        clienteId: formReceita.clienteId || null,
      };

      const res = await fetch(
        editandoId ? `/api/receitas/${editandoId}` : "/api/receitas",
        {
          method: editandoId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        }
      );
      if (!res.ok) return;

      setReceitaAberta(false);
      setEditandoId(null);
      await carregar();
    } finally {
      setSalvandoReceita(false);
    }
  }

  async function excluirReceita(id: string) {
    if (!confirm("Excluir esta receita? A ação não pode ser desfeita.")) return;
    await fetch(`/api/receitas/${id}`, { method: "DELETE" });
    await carregar();
  }

  /**
   * Marcar como recebida. Não há nada a propagar manualmente: painel, Cliente
   * 360° e Saúde derivam desta mesma linha, então recarregar já reflete tudo.
   */
  async function receber(id: string) {
    setRecebendoId(id);
    try {
      await fetch(`/api/receitas/${id}/receber`, { method: "POST" });
      await carregar();
    } finally {
      setRecebendoId(null);
    }
  }

  async function replicarRecorrentes() {
    setReplicando(true);
    try {
      await fetch("/api/receitas/replicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      await carregar();
    } finally {
      setReplicando(false);
    }
  }

  async function salvarDespesa() {
    setSalvandoDespesa(true);
    try {
      const res = await fetch("/api/despesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: formDespesa.descricao.trim(),
          valorCentavos: parseBRL(formDespesa.valor),
          categoria: formDespesa.categoria,
          recorrente: formDespesa.recorrente,
          competencia: formDespesa.competencia,
        }),
      });
      if (!res.ok) return;
      setDespesaAberta(false);
      await carregar();
    } finally {
      setSalvandoDespesa(false);
    }
  }

  async function excluirDespesa(id: string) {
    await fetch(`/api/despesas/${id}`, { method: "DELETE" });
    await carregar();
  }

  async function salvarSaldo() {
    await fetch("/api/config/saldo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saldoCaixa: parseBRL(saldoInput) }),
    });
    setSaldoEdit(false);
    await carregar();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const resumo = dados?.resumo;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Financeiro</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {dados?.mesCorrente === false
              ? `Vendo ${mesPorExtenso(mes)} — Runway e vencidos refletem hoje`
              : "Receita, recebimentos e caixa"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="month"
            value={mes}
            onChange={(e) => {
              setCarregando(true);
              setMes(e.target.value);
            }}
            className="rounded-[10px] border border-border bg-surface-2/60 px-2.5 py-1.5 text-[12px] outline-none transition-colors duration-150 focus:border-brand"
            style={{ colorScheme: "dark" }}
          />
          <button onClick={abrirNova} className="btn-primary text-[13px]">
            <Plus className="h-4 w-4" /> Nova receita
          </button>
        </div>
      </header>

      {carregando && !dados && (
        <div className="h-[104px] animate-pulse rounded-[12px] border border-border-subtle bg-surface/40" />
      )}

      {erro && (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-danger/25 bg-danger/8 px-4 py-3 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível carregar o financeiro. Recarregue a página.
        </div>
      )}

      {dados && resumo && (
        <div className="space-y-6">
          <MetricStrip metricas={montarMetricas(resumo, dados.mesCorrente)} />

          {/* Saldo e projeção: o contexto dos dois números da direita da faixa */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-2">
              Saldo em caixa
              {saldoEdit ? (
                <span className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={saldoInput}
                    onChange={(e) => setSaldoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") salvarSaldo();
                      if (e.key === "Escape") setSaldoEdit(false);
                    }}
                    placeholder="0,00"
                    className="w-24 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
                  />
                  <button onClick={salvarSaldo} className="text-[color:var(--success)]">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => setSaldoEdit(false)} className="text-muted">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => {
                    setSaldoInput((resumo.saldoCaixa / 100).toFixed(2).replace(".", ","));
                    setSaldoEdit(true);
                  }}
                  className="inline-flex items-center gap-1 tabular-nums text-foreground-2 transition-colors duration-150 hover:text-brand"
                >
                  {fmtBRL(resumo.saldoCaixa)}
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              )}
            </span>

            {dados.projecao30Dias > 0 && (
              <span className="text-muted-2">
                Próximos 30 dias{" "}
                <span className="tabular-nums text-foreground-2">
                  {fmtBRL(dados.projecao30Dias)}
                </span>{" "}
                previstos
              </span>
            )}

            {resumo.despesasMes > 0 && (
              <span className="text-muted-2">
                Despesas do mês{" "}
                <span className="tabular-nums text-foreground-2">{fmtBRL(resumo.despesasMes)}</span>
              </span>
            )}
          </div>

          {/* Recorrências do mês anterior ainda não lançadas */}
          {dados.recorrentesPendentes > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border border-brand/20 bg-brand/[0.06] px-3.5 py-2.5">
              <span className="text-[12px] text-foreground-2">
                {dados.recorrentesPendentes}{" "}
                {dados.recorrentesPendentes === 1 ? "recorrência" : "recorrências"} do mês anterior
                ainda não {dados.recorrentesPendentes === 1 ? "lançada" : "lançadas"} em{" "}
                {mesPorExtenso(mes)}.
              </span>
              <button
                onClick={replicarRecorrentes}
                disabled={replicando}
                className="text-[12px] font-medium text-brand transition-colors duration-150 hover:text-foreground disabled:opacity-50"
              >
                {replicando ? "Lançando…" : "Lançar agora"}
              </button>
            </div>
          )}

          <Vencidas receitas={dados.vencidas} onReceber={receber} recebendoId={recebendoId} />

          <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 xl:grid-cols-[1.5fr_1fr]">
            {/* Evolução */}
            <Section>
              <SectionHeader
                titulo="Evolução da receita"
                meta="últimos 6 meses"
                href={undefined}
              />
              {!dados.temHistorico ? (
                <EmptyLine
                  titulo="Ainda não há histórico suficiente para mostrar a evolução da receita."
                  descricao="A partir de dois meses com movimento, o gráfico aparece."
                />
              ) : (
                <>
                  <div className="flex items-center gap-1 pt-2">
                    {(
                      [
                        { key: "LINHA", label: "Por linha" },
                        { key: "NATUREZA", label: "Recorrente × pontual" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.key}
                        onClick={() => setComposicao(o.key)}
                        className={`rounded-md px-2 py-0.5 text-[11px] transition-colors duration-150 ${
                          composicao === o.key
                            ? "bg-brand/15 text-brand"
                            : "text-muted-2 hover:text-foreground-2"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <ReceitaEvolucaoChart data={dados.evolucao} composicao={composicao} />
                  </div>
                </>
              )}
            </Section>

            <div className="space-y-6">
              <ReceitaPorLinha linhas={dados.porLinha} />
              <PrincipaisClientes clientes={dados.topClientes} />
            </div>
          </div>

          {/* Receitas do mês */}
          <Section>
            <SectionHeader
              titulo={`Receitas — ${mesPorExtenso(mes)}`}
              meta={
                dados.receitas.length > 0
                  ? `${dados.receitas.length} ${dados.receitas.length === 1 ? "lançamento" : "lançamentos"}`
                  : undefined
              }
            />
            {dados.receitas.length === 0 ? (
              <div className="flex items-baseline gap-2 py-2.5">
                <span className="text-[12px] text-muted">Nenhuma receita neste mês.</span>
                <button
                  onClick={abrirNova}
                  className="text-[12px] text-brand transition-colors duration-150 hover:text-foreground"
                >
                  + Adicionar receita
                </button>
              </div>
            ) : (
              <TabelaReceitas
                receitas={dados.receitas}
                onEditar={abrirEdicao}
                onExcluir={excluirReceita}
                onReceber={receber}
                recebendoId={recebendoId}
              />
            )}
          </Section>

          <Despesas
            despesas={dados.despesas}
            totalCentavos={resumo.despesasMes}
            onNova={() => {
              setFormDespesa(despesaVazia(mes));
              setDespesaAberta(true);
            }}
            onExcluir={excluirDespesa}
          />
        </div>
      )}

      {receitaAberta && (
        <DrawerReceita
          form={formReceita}
          setForm={setFormReceita}
          clientes={clientes}
          editando={Boolean(editandoId)}
          salvando={salvandoReceita}
          onSalvar={salvarReceita}
          onFechar={() => {
            setReceitaAberta(false);
            setEditandoId(null);
          }}
        />
      )}

      {despesaAberta && (
        <DrawerDespesa
          form={formDespesa}
          setForm={setFormDespesa}
          salvando={salvandoDespesa}
          onSalvar={salvarDespesa}
          onFechar={() => setDespesaAberta(false)}
        />
      )}
    </div>
  );
}
