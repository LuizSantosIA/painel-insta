import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { proximaAcaoDoCliente, type ProximaAcaoCliente } from "@/lib/cliente-360";
import { resumirSaude, type SaudeResumo } from "@/lib/negocio-overview";
import { ordemSaude, type DiagnosticoSaude } from "@/lib/saude";
import { INCLUDE_SAUDE, diagnosticarCliente, sincronizarHistoricoSaude } from "@/lib/saude-server";

/** Uma linha da tela de Saúde: quem é, o diagnóstico e o que fazer a respeito. */
export interface ClienteSaudeItem {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  status: string;
  /**
   * Última observação sobre o cliente. Vem da timeline (interação NOTA); o campo
   * legado saudeNota só aparece quando não há nenhuma — nada é perdido, e daqui
   * para frente observação nova é interação, não um segundo mecanismo de notas.
   */
  observacao: { texto: string; em: string | null } | null;
  /** Tudo que a engine concluiu — motivos, sinais positivos, ação e contexto. */
  diagnostico: DiagnosticoSaude;
  /** Tarefa ou compromisso em aberto mais próximo — a mesma da lista de Clientes. */
  proximaAcao: ProximaAcaoCliente | null;
  receitaRecebidaCentavos: number;
}

export interface CarteiraSaude {
  /** Mesmo resumo que o painel de /negocio mostra — uma contagem só. */
  resumo: SaudeResumo;
  clientes: ClienteSaudeItem[];
}

/** A observação mais recente da timeline; sem nenhuma, o campo legado. */
function ultimaObservacao(
  interacoes: { tipo: string; nota: string; ocorreuEm: Date }[],
  saudeNota: string | null
): { texto: string; em: string | null } | null {
  const notas = interacoes
    .filter((i) => i.tipo === "NOTA" && i.nota.trim())
    .sort((a, b) => b.ocorreuEm.getTime() - a.ocorreuEm.getTime());

  if (notas.length > 0) {
    return { texto: notas[0].nota, em: notas[0].ocorreuEm.toISOString() };
  }
  return saudeNota?.trim() ? { texto: saudeNota, em: null } : null;
}

export async function GET() {
  const agora = new Date();

  const clientes = await prisma.client.findMany({
    where: { arquivadoEm: null, status: { in: ["active", "lead", "inactive"] } },
    include: INCLUDE_SAUDE,
  });

  const lista: ClienteSaudeItem[] = clientes.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    instagram: c.instagram,
    status: c.status,
    observacao: ultimaObservacao(c.interacoes, c.saudeNota),
    diagnostico: diagnosticarCliente(c, agora),
    proximaAcao: proximaAcaoDoCliente(c.tasks, c.compromissos),
    receitaRecebidaCentavos: c.receitas
      .filter((r) => r.status === "RECEBIDA")
      .reduce((s, r) => s + r.valorCentavos, 0),
  }));

  // Ordem de urgência: risco → atenção → sem dados → saudável. Dentro da faixa,
  // o pior score primeiro e, empatado, quem tem mais receita recorrente em jogo.
  lista.sort((a, b) => {
    const faixa = ordemSaude(a.diagnostico.status) - ordemSaude(b.diagnostico.status);
    if (faixa !== 0) return faixa;
    const score = a.diagnostico.score - b.diagnostico.score;
    if (score !== 0) return score;
    const mrr = b.diagnostico.mrrCentavos - a.diagnostico.mrrCentavos;
    if (mrr !== 0) return mrr;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  // A varredura da carteira é o momento natural de carimbar a classificação e
  // registrar as transições. Idempotente: só escreve quando a faixa mudou.
  await sincronizarHistoricoSaude(
    clientes.map((c) => ({
      id: c.id,
      saudeStatus: c.saudeStatus,
      diagnostico: lista.find((l) => l.id === c.id)!.diagnostico,
    }))
  );

  const carteira: CarteiraSaude = {
    resumo: resumirSaude(
      lista.map((c) => ({ id: c.id, name: c.name, diagnostico: c.diagnostico }))
    ),
    clientes: lista,
  };

  return NextResponse.json(carteira);
}
