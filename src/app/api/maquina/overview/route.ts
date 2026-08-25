import { NextResponse } from "next/server";
import { carregarMaquina, JANELA_DIAS } from "@/lib/maquina-dados";
import {
  montarAlertasMaquina,
  montarFunil,
  ordenarConteudos,
  type AlertaMaquina,
  type EtapaFunil,
} from "@/lib/maquina";
import type {
  AutomacaoMaquina,
  ConteudoMaquina,
  ConversaMaquina,
  MetaMaquina,
  TotaisMaquina,
} from "@/lib/maquina-dados";

/** Tudo que o painel da Máquina precisa, numa requisição só. */
export interface MaquinaOverview {
  janelaDias: number;
  totais: TotaisMaquina;
  meta: MetaMaquina;
  funil: EtapaFunil[];
  alertas: AlertaMaquina[];
  /** Conteúdos que mais geraram negócio — não os que mais geraram curtida. */
  topConteudos: ConteudoMaquina[];
  /** Automações com algum resultado, da que mais entrega para a que menos. */
  topAutomacoes: AutomacaoMaquina[];
  /** Conversas que dependem de uma resposta minha. */
  conversasAbertas: ConversaMaquina[];
}

export async function GET() {
  const dados = await carregarMaquina();
  const { totais, meta } = dados;

  const funil = montarFunil({
    visualizacoes: totais.alcanceTotal,
    interacoes: totais.interacoesTotal,
    conversas: totais.conversasTotal,
    leads: totais.leadsTotal,
    oportunidades: totais.oportunidadesTotal,
    clientes: totais.clientesTotal,
    receitaCentavos: totais.receitaAtribuidaCentavos,
  });

  const alertas = montarAlertasMaquina({
    aguardandoResposta: totais.aguardandoResposta,
    leadsNaoTratados: dados.leadsNaoTratados,
    agendadosVencidos: dados.agendadosVencidos,
    diasSemPublicar: meta.diasSemPublicar,
    diasSemSincronizar: meta.diasSemSincronizar,
    instagramConectado: meta.instagramConectado,
    automacoesSemExecucao: meta.automacoesSemExecucao,
  });

  const publicados = dados.conteudos.filter((c) => c.status === "PUBLICADO");

  const overview: MaquinaOverview = {
    janelaDias: JANELA_DIAS,
    totais,
    meta,
    funil,
    alertas,
    topConteudos: ordenarConteudos(publicados, "conversas").slice(0, 5),
    topAutomacoes: dados.automacoes
      .filter((a) => a.execucoes > 0)
      .sort((a, b) => b.leads - a.leads || b.conversas - a.conversas || b.execucoes - a.execucoes)
      .slice(0, 5),
    conversasAbertas: dados.conversas
      .filter((c) => c.status === "NOVA" || c.status === "AGUARDANDO_VOCE")
      .slice(0, 6),
  };

  return NextResponse.json(overview);
}
