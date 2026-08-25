import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { type ResumoFinanceiro } from "@/lib/financeiro";
import { carregarResumo, mesCorrente, receitasEmAberto } from "@/lib/financeiro-server";
import { INCLUDE_SAUDE, diagnosticarCliente } from "@/lib/saude-server";
import {
  calcAReceberVencido,
  montarAlertas,
  montarProximos,
  resumirPipeline,
  resumirSaude,
  type AlertaNegocio,
  type ClienteSaudeOverview,
  type PipelineResumo,
  type ProximoItem,
  type ReceitaOverview,
  type SaudeResumo,
} from "@/lib/negocio-overview";

/** Tudo que o painel de /negocio precisa, numa requisição só. */
export interface NegocioOverview {
  financeiro: ResumoFinanceiro;
  aReceberVencido: number;
  clientesAtivos: number;
  pipeline: PipelineResumo;
  saude: SaudeResumo;
  alertas: AlertaNegocio[];
  proximos: ProximoItem[];
}

export async function GET() {
  const agora = new Date();

  // O financeiro inteiro vem de carregarResumo() — a mesma função que a tela de
  // Financeiro e a home usam. O painel não tem régua monetária própria.
  const [
    financeiro,
    todasReceitas,
    leads,
    compromissos,
    tarefas,
    clientes,
    clientesAtivos,
  ] = await Promise.all([
    carregarResumo(mesCorrente(agora), agora),
    receitasEmAberto(),
    prisma.lead.findMany(),
    prisma.compromisso.findMany({ where: { cumprido: false } }),
    prisma.task.findMany({
      where: { done: false },
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      where: { arquivadoEm: null, status: { in: ["active", "lead", "inactive"] } },
      include: INCLUDE_SAUDE,
    }),
    prisma.client.count({ where: { status: "active" } }),
  ]);

  const receitasAbertas: ReceitaOverview[] = todasReceitas.map((r) => ({
    id: r.id,
    descricao: r.descricao,
    valorCentavos: r.valorCentavos,
    tipo: r.tipo,
    status: r.status,
    competencia: r.competencia,
    vencimento: r.vencimento,
    clienteId: r.clienteId,
    clienteNome: r.cliente?.name ?? null,
  }));

  // O diagnóstico vem inteiro da engine — o painel não tem régua própria de saúde.
  const saudeClientes: ClienteSaudeOverview[] = clientes.map((c) => ({
    id: c.id,
    name: c.name,
    diagnostico: diagnosticarCliente(c, agora),
  }));

  const leadsOverview = leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    estagio: l.estagio,
    valorEstimadoCentavos: l.valorEstimadoCentavos,
    proximaAcao: l.proximaAcao,
    proximaAcaoEm: l.proximaAcaoEm,
    atualizadoEm: l.atualizadoEm,
  }));

  const compromissosOverview = compromissos.map((c) => ({
    id: c.id,
    descricao: c.descricao,
    para: c.para,
    prazoEm: c.prazoEm,
    cumprido: c.cumprido,
  }));

  const tarefasOverview = tarefas.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    done: t.done,
    clienteNome: t.client?.name ?? null,
  }));

  const overview: NegocioOverview = {
    financeiro,
    aReceberVencido: calcAReceberVencido(receitasAbertas, agora),
    clientesAtivos,
    pipeline: resumirPipeline(leadsOverview),
    saude: resumirSaude(saudeClientes),
    alertas: montarAlertas(
      {
        leads: leadsOverview,
        compromissos: compromissosOverview,
        tarefas: tarefasOverview,
        receitas: receitasAbertas,
        clientes: saudeClientes,
      },
      agora
    ),
    proximos: montarProximos(tarefasOverview, compromissosOverview),
  };

  return NextResponse.json(overview);
}
