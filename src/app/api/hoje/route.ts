import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { receitasEmAberto } from "@/lib/financeiro-server";
import { INCLUDE_SAUDE, diagnosticarCliente } from "@/lib/saude-server";
import { carregarMaquina } from "@/lib/maquina-dados";
import { montarAlertasMaquina } from "@/lib/maquina";
import { alertasEngine } from "@/lib/engine/alertas";
import {
  montarAlertas,
  type ClienteSaudeOverview,
  type ReceitaOverview,
} from "@/lib/negocio-overview";
import {
  agendaDeHoje,
  montarBriefing,
  priorizarAtencao,
  proximosDias,
  tarefasDeHoje,
  type BriefingDoDia,
} from "@/lib/hoje";

/**
 * A tela Hoje em uma requisição.
 *
 * Não existe regra de alerta aqui: os sinais vêm inteiros de montarAlertas
 * (negócio) e montarAlertasMaquina (máquina), exatamente as mesmas funções que
 * /negocio e /maquina usam. Esta rota só junta as duas listas e passa para a
 * camada de priorização.
 */
export type HojeOverview = BriefingDoDia;

export async function GET() {
  const agora = new Date();

  const [
    receitasAbertas,
    leads,
    compromissos,
    tarefasAbertas,
    clientes,
    maquina,
    alertasDaEngine,
  ] = await Promise.all([
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
    carregarMaquina(),
    alertasEngine(),
  ]);

  const receitas: ReceitaOverview[] = receitasAbertas.map((r) => ({
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

  const saudeClientes: ClienteSaudeOverview[] = clientes.map((c) => ({
    id: c.id,
    name: c.name,
    diagnostico: diagnosticarCliente(c, agora),
  }));

  const compromissosOverview = compromissos.map((c) => ({
    id: c.id,
    descricao: c.descricao,
    para: c.para,
    prazoEm: c.prazoEm,
    cumprido: c.cumprido,
  }));

  const tarefasOverview = tarefasAbertas.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    done: t.done,
    priority: t.priority,
    clienteNome: t.client?.name ?? null,
  }));

  // ── Os dois produtores de alerta, sem nenhuma regra nova ──
  const alertasNegocio = montarAlertas(
    {
      leads: leads.map((l) => ({
        id: l.id,
        nome: l.nome,
        estagio: l.estagio,
        valorEstimadoCentavos: l.valorEstimadoCentavos,
        proximaAcao: l.proximaAcao,
        proximaAcaoEm: l.proximaAcaoEm,
        atualizadoEm: l.atualizadoEm,
        estagioDesde: l.estagioDesde,
      })),
      compromissos: compromissosOverview,
      tarefas: tarefasOverview,
      receitas,
      clientes: saudeClientes,
    },
    agora
  );

  const alertasMaquina = montarAlertasMaquina({
    aguardandoResposta: maquina.totais.aguardandoResposta,
    leadsNaoTratados: maquina.leadsNaoTratados,
    agendadosVencidos: maquina.agendadosVencidos,
    diasSemPublicar: maquina.meta.diasSemPublicar,
    diasSemSincronizar: maquina.meta.diasSemSincronizar,
    instagramConectado: maquina.meta.instagramConectado,
    automacoesSemExecucao: maquina.meta.automacoesSemExecucao,
  });

  const briefing = montarBriefing({
    agora,
    atencao: priorizarAtencao([...alertasNegocio, ...alertasMaquina, ...alertasDaEngine]),
    agenda: agendaDeHoje(compromissosOverview),
    tarefas: tarefasDeHoje(tarefasOverview),
    proximos: proximosDias(compromissosOverview, tarefasOverview),
  });

  return NextResponse.json(briefing);
}
