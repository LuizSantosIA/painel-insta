import { NextResponse } from "next/server";
import { carregarMaquina, type AutomacaoMaquina } from "@/lib/maquina-dados";

/**
 * As automações vistas pelo resultado, não pela configuração.
 *
 * "Executou 184 vezes" não diz se a automação presta. O que diz é quantas dessas
 * execuções viraram conversa, lead, oportunidade e dinheiro. Cada elo aparece
 * apenas quando pôde ser atribuído — nunca estimado.
 */
export interface AutomacoesLista {
  automacoes: AutomacaoMaquina[];
  totais: {
    ativas: number;
    execucoes: number;
    conversas: number;
    leads: number;
    oportunidades: number;
    receitaCentavos: number;
  };
}

export async function GET() {
  const { automacoes } = await carregarMaquina();

  const resposta: AutomacoesLista = {
    automacoes,
    totais: {
      ativas: automacoes.filter((a) => a.ativa).length,
      execucoes: automacoes.reduce((s, a) => s + a.execucoes, 0),
      conversas: automacoes.reduce((s, a) => s + a.conversas, 0),
      leads: automacoes.reduce((s, a) => s + a.leads, 0),
      oportunidades: automacoes.reduce((s, a) => s + a.oportunidades, 0),
      receitaCentavos: automacoes.reduce((s, a) => s + a.receitaCentavos, 0),
    },
  };

  return NextResponse.json(resposta);
}
