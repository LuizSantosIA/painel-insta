"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import type { ClienteOverview } from "@/app/api/clients/[id]/overview/route";
import { AttentionList } from "@/components/negocio/attention-list";
import { Label, Section, SectionHeader } from "@/components/negocio/panel";
import { DiagnosticoDetalhe } from "@/components/saude/diagnostico-detalhe";
import { Avatar, SaudeIndicator, StatusBadge } from "@/components/cliente/saude-indicator";
import { RowMenu } from "@/components/cliente/row-menu";
import { NovaAcao } from "@/components/cliente/nova-acao";
import { Timeline } from "@/components/cliente/timeline";
import {
  DadosContato,
  FinanceiroCliente,
  PipelineCliente,
  ProximasAcoes,
} from "@/components/cliente/blocos-laterais";

/** Uma métrica da faixa executiva do cliente. */
function Metrica({ label, valor, atenuado }: { label: string; valor: string; atenuado?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
      <Label>{label}</Label>
      <span
        className={`text-[19px] font-semibold leading-none tracking-tight tabular-nums ${
          atenuado ? "text-muted-2" : "text-foreground"
        }`}
      >
        {valor}
      </span>
    </div>
  );
}

export default function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [dados, setDados] = useState<ClienteOverview | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [versao, setVersao] = useState(0);

  /** Pede uma releitura do perfil. Usado depois de criar/alterar alguma coisa. */
  const carregar = useCallback(() => setVersao((n) => n + 1), []);

  useEffect(() => {
    let ativo = true;

    fetch(`/api/clients/${id}/overview`)
      .then(async (res) => {
        if (!ativo) return;
        if (!res.ok) {
          setErro(res.status === 404 ? "Cliente não encontrado." : "Não foi possível carregar.");
          return;
        }
        setDados(await res.json());
        setErro(null);
      })
      .catch(() => {
        if (ativo) setErro("Erro de conexão.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [id, versao]);

  async function alterarStatus(novo: string) {
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    carregar();
  }

  async function arquivar() {
    if (!dados) return;
    const arquivando = !dados.cliente.arquivadoEm;
    if (arquivando && !confirm(`Arquivar ${dados.cliente.name}? O histórico é preservado.`)) return;
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arquivadoEm: arquivando ? new Date().toISOString() : null }),
    });
    carregar();
  }

  async function excluir() {
    if (!dados) return;
    if (!confirm(`Excluir ${dados.cliente.name} definitivamente? As interações são apagadas junto.`)) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.push("/negocio/clientes");
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-8 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando cliente…
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="space-y-4">
        <Link
          href="/negocio/clientes"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Clientes
        </Link>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-danger/25 bg-danger/8 px-4 py-3 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      </div>
    );
  }

  const { cliente, metricas, saude } = dados;

  const metricasFaixa = [
    { label: "MRR", valor: metricas.mrrCentavos > 0 ? fmtBRL(metricas.mrrCentavos) : "—", atenuado: metricas.mrrCentavos === 0 },
    { label: "Receita total", valor: metricas.receitaTotalCentavos > 0 ? fmtBRL(metricas.receitaTotalCentavos) : "—", atenuado: metricas.receitaTotalCentavos === 0 },
    // Vencido só ocupa uma coluna quando existe — não há métrica zerada na faixa.
    ...(metricas.vencidoCentavos > 0
      ? [{ label: "Vencido", valor: fmtBRL(metricas.vencidoCentavos), atenuado: false }]
      : []),
    { label: "Oportunidades", valor: String(metricas.oportunidadesAbertas), atenuado: metricas.oportunidadesAbertas === 0 },
    { label: "Tarefas abertas", valor: String(metricas.tarefasAbertas), atenuado: metricas.tarefasAbertas === 0 },
    { label: "Cliente desde", valor: metricas.clienteDesde },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/negocio/clientes"
        className="group inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-none"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
        Clientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar nome={cliente.name} tamanho={38} />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[20px] font-semibold leading-tight tracking-tight">
                {cliente.name}
              </h1>
              <StatusBadge status={cliente.status} />
              <SaudeIndicator status={saude} motivo={dados.diagnostico.resumo} />
              {cliente.arquivadoEm && (
                <span className="rounded-md border border-border px-1.5 py-[1px] text-[11px] text-muted-2">
                  Arquivado
                </span>
              )}
            </div>
            <DadosContato
              email={cliente.email}
              phone={cliente.phone}
              instagram={cliente.instagram}
              company={cliente.company}
              criadoEm={cliente.createdAt}
              ultimoContatoEm={cliente.ultimoContatoEm}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <NovaAcao clienteId={cliente.id} clienteNome={cliente.name} onCriado={carregar} />
          <RowMenu
            status={cliente.status}
            arquivado={Boolean(cliente.arquivadoEm)}
            onEditar={() => router.push(`/negocio/clientes?editar=${cliente.id}`)}
            onStatus={alterarStatus}
            onArquivar={arquivar}
            onExcluir={excluir}
          />
        </div>
      </header>

      {/* Faixa executiva — mesmo padrão da /negocio, sem cards soltos */}
      <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface/40">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {metricasFaixa.map((m, i) => (
            <div
              key={m.label}
              className={[
                i > 0 ? "border-t border-border-subtle sm:border-t-0" : "",
                i >= 3 ? "sm:border-t sm:border-border-subtle lg:border-t-0" : "",
                i % 2 === 1 ? "border-l border-border-subtle sm:border-l-0" : "",
                i % 3 !== 0 ? "sm:border-l sm:border-border-subtle" : "",
                i > 0 ? "lg:border-l lg:border-border-subtle" : "",
              ].join(" ")}
            >
              <Metrica {...m} />
            </div>
          ))}
        </div>
      </div>

      <AttentionList alertas={dados.alertas} />

      <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 lg:grid-cols-[1.6fr_1fr]">
        <Timeline eventos={dados.timeline} />

        <div className="space-y-6">
          {/* Mesma explicação que a tela de Saúde mostra — uma engine só. */}
          <Section>
            <SectionHeader titulo="Diagnóstico de saúde" meta={dados.diagnostico.resumo} />
            <div className="pt-2.5">
              <DiagnosticoDetalhe diagnostico={dados.diagnostico} clienteId={cliente.id} />
            </div>
          </Section>

          <ProximasAcoes
            tarefas={dados.tarefas}
            compromissos={dados.compromissos}
            onNovaTarefa={() => router.push("/negocio/tarefas?novo=1")}
          />
          <FinanceiroCliente
            metricas={metricas}
            receitas={dados.receitas}
            clienteId={cliente.id}
          />
          <PipelineCliente leads={dados.leads} clienteId={cliente.id} />
        </div>
      </div>

      {cliente.notes && (
        <div className="rounded-[10px] border border-border-subtle bg-surface/40 p-3">
          <Label>Observações</Label>
          <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground-2">
            {cliente.notes}
          </p>
        </div>
      )}
    </div>
  );
}
