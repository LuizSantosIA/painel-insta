"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import type { NegocioOverview } from "@/app/api/negocio/overview/route";
import { AttentionList } from "@/components/negocio/attention-list";
import { ClientHealthSummary } from "@/components/negocio/client-health-summary";
import { FinanceSummary } from "@/components/negocio/finance-summary";
import { MetricStrip, type BusinessMetricProps } from "@/components/negocio/metric-strip";
import { NewButton } from "@/components/negocio/new-button";
import { PipelineSummary } from "@/components/negocio/pipeline-summary";
import { OverviewSkeleton } from "@/components/negocio/skeletons";
import { UpcomingItems } from "@/components/negocio/upcoming-items";

/** Monta a faixa de KPIs. Sem dado real, o indicador mostra "—" e explica o porquê. */
function montarMetricas(dados: NegocioOverview): BusinessMetricProps[] {
  const { financeiro, pipeline, saude, aReceberVencido, clientesAtivos } = dados;

  const variacao = financeiro.mrrVariacao;
  const precisamAtencao = saude.vermelho + saude.amarelo;

  return [
    {
      label: "MRR atual",
      valor: financeiro.mrrAtual > 0 ? fmtBRL(financeiro.mrrAtual) : null,
      auxiliar:
        variacao !== null
          ? `${variacao > 0 ? "+" : ""}${variacao.toFixed(0)}% vs. mês anterior`
          : "sem base de comparação",
      tomAuxiliar: variacao === null ? "neutro" : variacao >= 0 ? "positivo" : "negativo",
      vazioDica: "nenhuma receita recorrente no mês",
    },
    {
      label: "Pipeline aberto",
      valor:
        pipeline.quantidade > 0 && pipeline.totalCentavos > 0
          ? fmtBRL(pipeline.totalCentavos)
          : null,
      auxiliar: `${pipeline.quantidade} ${pipeline.quantidade === 1 ? "oportunidade" : "oportunidades"}`,
      vazioDica:
        pipeline.quantidade === 0
          ? "nenhuma oportunidade aberta"
          : `${pipeline.quantidade} sem valor estimado`,
    },
    {
      label: "A receber",
      valor: financeiro.aReceber > 0 ? fmtBRL(financeiro.aReceber) : null,
      auxiliar: aReceberVencido > 0 ? `${fmtBRL(aReceberVencido)} vencidos` : "nada vencido",
      tomAuxiliar: aReceberVencido > 0 ? "negativo" : "positivo",
      vazioDica: "nenhuma receita confirmada em aberto",
    },
    {
      label: "Clientes ativos",
      valor: saude.total > 0 ? String(clientesAtivos) : null,
      auxiliar:
        precisamAtencao > 0
          ? `${precisamAtencao} ${precisamAtencao === 1 ? "precisa" : "precisam"} de atenção`
          : "todos saudáveis",
      tomAuxiliar: precisamAtencao > 0 ? "negativo" : "positivo",
      vazioDica: "nenhum cliente cadastrado",
    },
  ];
}

export default function NegocioPage() {
  const [dados, setDados] = useState<NegocioOverview | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    fetch("/api/negocio/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((json: NegocioOverview) => {
        if (ativo) setDados(json);
      })
      .catch(() => {
        if (ativo) setErro(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Negócio</h1>
          <p className="mt-0.5 text-[12px] text-muted">Visão geral da operação</p>
        </div>
        <NewButton />
      </header>

      {carregando && <OverviewSkeleton />}

      {!carregando && erro && (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-danger/25 bg-danger/8 px-4 py-3.5 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível carregar o painel. Recarregue a página.
        </div>
      )}

      {!carregando && !erro && dados && (
        <div className="space-y-4">
          <MetricStrip metricas={montarMetricas(dados)} />

          <AttentionList alertas={dados.alertas} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <FinanceSummary resumo={dados.financeiro} aReceberVencido={dados.aReceberVencido} />
            <PipelineSummary resumo={dados.pipeline} />
            <ClientHealthSummary resumo={dados.saude} />
            <UpcomingItems itens={dados.proximos} />
          </div>
        </div>
      )}
    </div>
  );
}
