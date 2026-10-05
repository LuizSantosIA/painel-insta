import "server-only";
import { prisma } from "@/lib/prisma";
import { receitasEmAberto } from "@/lib/financeiro-server";
import { INCLUDE_SAUDE, diagnosticarCliente } from "@/lib/saude-server";
import { carregarMaquina } from "@/lib/maquina-dados";
import { montarAlertasMaquina } from "@/lib/maquina";
import { alertasEngine } from "@/lib/engine/alertas";
import { montarAlertas, type ClienteSaudeOverview, type ReceitaOverview } from "@/lib/negocio-overview";
import {
  agendaDeHoje,
  montarBriefing,
  priorizarAtencao,
  proximosDias,
  tarefasDeHoje,
  type BriefingDoDia,
} from "@/lib/hoje";

/**
 * O dia inteiro em uma função.
 *
 * Não existe regra de alerta aqui: os sinais vêm inteiros de montarAlertas
 * (negócio), montarAlertasMaquina (máquina) e alertasEngine (conteúdo) —
 * exatamente as mesmas funções que /negocio e /maquina usam. Esta camada só
 * junta as listas e passa para a priorização.
 *
 * Usada pela tela Hoje (/api/hoje) e pela superfície MCP, para que o painel e o
 * Jarvis nunca discordem sobre o que é prioridade.
 */
export async function carregarBriefing(agora = new Date()): Promise<BriefingDoDia> {
  const [receitasAbertas, leads, compromissos, tarefasAbertas, clientes, maquina, alertasDaEngine] =
    await Promise.all([
      receitasEmAberto(),
      prisma.lead.findMany(),
      prisma.compromisso.findMany({ where: { cumprido: false } }),
      prisma.task.findMany({ where: { done: false }, include: { client: { select: { name: true } } } }),
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

  return montarBriefing({
    agora,
    atencao: priorizarAtencao([...alertasNegocio, ...alertasMaquina, ...alertasDaEngine]),
    agenda: agendaDeHoje(compromissosOverview),
    tarefas: tarefasDeHoje(tarefasOverview),
    proximos: proximosDias(compromissosOverview, tarefasOverview),
  });
}
