"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import type { MaquinaOverview } from "@/app/api/maquina/overview/route";
import { AttentionList } from "@/components/negocio/attention-list";
import { MetricStrip, type BusinessMetricProps } from "@/components/negocio/metric-strip";
import { OverviewSkeleton } from "@/components/negocio/skeletons";
import { Funil } from "@/components/maquina/funil";
import {
  AutomacoesResumo,
  ConteudoDestaque,
  ConversasAbertas,
  LinkAudiencia,
  ReceitaAtribuida,
} from "@/components/maquina/resumos";

/**
 * Visão executiva da aquisição.
 *
 * A tela responde, de cima para baixo: estou produzindo? isso virou conversa?
 * conversa virou lead? lead virou oportunidade? oportunidade virou cliente e
 * dinheiro? Cada indicador que não tem dado mostra "—" e explica a ausência —
 * nunca um zero disfarçado de resultado.
 */
function montarMetricas(d: MaquinaOverview): BusinessMetricProps[] {
  const { totais, janelaDias } = d;

  return [
    {
      label: "Conteúdos publicados",
      valor: totais.publicadosPeriodo > 0 ? String(totais.publicadosPeriodo) : null,
      auxiliar: `${totais.publicadosTotal} no total`,
      vazioDica:
        totais.publicadosTotal > 0
          ? `nada publicado em ${janelaDias} dias`
          : "nenhum conteúdo sincronizado",
    },
    {
      label: "Conversas iniciadas",
      valor: totais.conversasPeriodo > 0 ? String(totais.conversasPeriodo) : null,
      auxiliar: `${totais.conversasTotal.toLocaleString("pt-BR")} no total`,
      vazioDica:
        totais.conversasTotal > 0
          ? `nenhuma conversa nova em ${janelaDias} dias`
          : "nenhuma conversa registrada",
    },
    {
      label: "Leads gerados",
      valor: totais.leadsPeriodo > 0 ? String(totais.leadsPeriodo) : null,
      auxiliar: `${totais.leadsTotal} no total`,
      tomAuxiliar: totais.leadsTotal > 0 ? "neutro" : "negativo",
      vazioDica:
        totais.conversasTotal > 0
          ? "conversas não viraram lead"
          : "nenhum lead vindo do Instagram",
    },
    {
      label: "Oportunidades",
      valor: totais.oportunidadesTotal > 0 ? String(totais.oportunidadesTotal) : null,
      auxiliar: `${totais.clientesTotal} ${totais.clientesTotal === 1 ? "cliente" : "clientes"}`,
      vazioDica: "nenhum lead qualificado ainda",
    },
    {
      label: "Receita atribuída",
      valor:
        totais.receitaAtribuidaCentavos !== null
          ? fmtBRL(totais.receitaAtribuidaCentavos)
          : null,
      auxiliar: "recebida, via cadeia completa",
      tomAuxiliar: "positivo",
      vazioDica: "atribuição desconhecida",
    },
  ];
}

export default function MaquinaVisaoGeralPage() {
  const [dados, setDados] = useState<MaquinaOverview | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    fetch("/api/maquina/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((json: MaquinaOverview) => {
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
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Máquina</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            Sistema de aquisição · conteúdo → conversa → lead → cliente
          </p>
        </div>
        <LinkAudiencia />
      </header>

      {carregando && <OverviewSkeleton />}

      {!carregando && erro && (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-danger/25 bg-danger/8 px-4 py-3.5 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível carregar o painel. Recarregue a página.
        </div>
      )}

      {!carregando && !erro && dados && (
        <div className="space-y-6">
          <MetricStrip metricas={montarMetricas(dados)} colunas={5} />

          <AttentionList alertas={dados.alertas} />

          <Funil etapas={dados.funil} />

          <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 xl:grid-cols-2">
            <ConteudoDestaque conteudos={dados.topConteudos} />
            <AutomacoesResumo automacoes={dados.topAutomacoes} />
            <ConversasAbertas conversas={dados.conversasAbertas} />
            <ReceitaAtribuida
              centavos={dados.totais.receitaAtribuidaCentavos}
              clientes={dados.totais.clientesTotal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
