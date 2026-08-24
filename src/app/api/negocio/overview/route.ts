import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcResumoFinanceiro, mesParaDate, ultimosMeses, type ResumoFinanceiro } from "@/lib/financeiro";
import { calcSaude } from "@/lib/saude";
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
  const mes = agora.toISOString().slice(0, 7);

  const start = mesParaDate(mes);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const startPrev = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const endPrev = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last3 = ultimosMeses(3);

  const [
    receitasMes,
    receitasPrev,
    todasReceitas,
    config,
    leads,
    compromissos,
    tarefas,
    clientes,
    clientesAtivos,
    ...despesasMeses
  ] = await Promise.all([
    prisma.receita.findMany({ where: { competencia: { gte: start, lt: end } } }),
    prisma.receita.findMany({ where: { competencia: { gte: startPrev, lt: endPrev } } }),
    prisma.receita.findMany({
      where: { status: { not: "RECEBIDA" } },
      include: { cliente: { select: { name: true } } },
    }),
    prisma.config.findUnique({ where: { id: "singleton" } }),
    prisma.lead.findMany(),
    prisma.compromisso.findMany({ where: { cumprido: false } }),
    prisma.task.findMany({
      where: { done: false },
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      where: { status: { in: ["active", "lead", "inactive"] } },
      include: { receitas: { select: { status: true, competencia: true } } },
    }),
    prisma.client.count({ where: { status: "active" } }),
    ...last3.map((m) => {
      const s = mesParaDate(m);
      const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
      return prisma.despesa.aggregate({
        where: { competencia: { gte: s, lt: e } },
        _sum: { valorCentavos: true },
      });
    }),
  ]);

  const financeiro = calcResumoFinanceiro({
    receitasMes,
    receitasMesAnterior: receitasPrev,
    saldoCentavos: config?.saldoCaixa ?? 0,
    despesasPorMes: despesasMeses.map((d) => ({ totalCentavos: d._sum.valorCentavos ?? 0 })),
  });

  const receitasAbertas: ReceitaOverview[] = todasReceitas.map((r) => ({
    id: r.id,
    descricao: r.descricao,
    valorCentavos: r.valorCentavos,
    status: r.status,
    competencia: r.competencia,
    clienteNome: r.cliente?.name ?? null,
  }));

  const saudeClientes: ClienteSaudeOverview[] = clientes.map((c) => ({
    id: c.id,
    name: c.name,
    saude: calcSaude({
      status: c.status,
      ultimoContatoEm: c.ultimoContatoEm,
      receitas: c.receitas.map((r) => ({ status: r.status, competencia: r.competencia })),
    }),
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
