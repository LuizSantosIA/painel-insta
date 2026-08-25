// Ponte entre o banco e a engine de saúde (src/lib/saude.ts).
//
// Existe para que "quais sinais o diagnóstico lê do banco" seja decidido em um
// lugar só. As rotas carregam com INCLUDE_SAUDE e chamam diagnosticarCliente —
// nenhuma delas monta o contexto por conta própria.

import { prisma } from "@/lib/prisma";
import {
  calcularSaudeCliente,
  type ContextoSaude,
  type DiagnosticoSaude,
  type StatusSaude,
  labelSaude,
} from "@/lib/saude";

/** Relações que a engine consome. Usado por todas as rotas que diagnosticam. */
export const INCLUDE_SAUDE = {
  // vencimento entra porque é ele que define atraso — a régua mora em financeiro.ts
  // (sem a coluna preenchida, vale o último dia da competência, como antes).
  receitas: {
    select: {
      status: true,
      tipo: true,
      valorCentavos: true,
      competencia: true,
      vencimento: true,
    },
  },
  // title/descricao entram porque a mesma carga alimenta a "próxima ação" da lista.
  tasks: { select: { done: true, dueDate: true, title: true } },
  compromissos: { select: { cumprido: true, prazoEm: true, descricao: true } },
  leads: {
    select: {
      estagio: true,
      proximaAcao: true,
      proximaAcaoEm: true,
      estagioDesde: true,
      atualizadoEm: true,
    },
  },
  // nota entra porque a tela de Saúde mostra a última observação registrada.
  interacoes: { select: { tipo: true, nota: true, ocorreuEm: true } },
} as const;

/**
 * Forma mínima esperada de um cliente carregado com INCLUDE_SAUDE.
 * Tipagem estrutural: rotas que carregam relações completas também servem.
 */
export interface ClienteComSinais {
  status: string;
  createdAt: Date | string;
  arquivadoEm?: Date | string | null;
  ultimoContatoEm: Date | string | null;
  receitas: { status: string; tipo: string; valorCentavos: number; competencia: Date | string }[];
  tasks: { done: boolean; dueDate: Date | string | null; title: string }[];
  compromissos: { cumprido: boolean; prazoEm: Date | string; descricao: string }[];
  leads: {
    estagio: string;
    proximaAcao: string | null;
    proximaAcaoEm: Date | string | null;
    estagioDesde?: Date | string | null;
    atualizadoEm: Date | string;
  }[];
  interacoes: { tipo: string; ocorreuEm: Date | string }[];
}

export function contextoDeCliente(c: ClienteComSinais, agora?: Date): ContextoSaude {
  return {
    status: c.status,
    criadoEm: c.createdAt,
    arquivadoEm: c.arquivadoEm ?? null,
    ultimoContatoEm: c.ultimoContatoEm,
    interacoes: c.interacoes,
    receitas: c.receitas,
    tarefas: c.tasks,
    compromissos: c.compromissos,
    oportunidades: c.leads,
    agora,
  };
}

/** O diagnóstico de um cliente já carregado. Mesma engine em todo lugar. */
export function diagnosticarCliente(c: ClienteComSinais, agora?: Date): DiagnosticoSaude {
  return calcularSaudeCliente(contextoDeCliente(c, agora));
}

// ─── Histórico de saúde ──────────────────────────────────────────────────────

/**
 * Guarda a classificação atual no cliente e, quando ela muda, registra o evento
 * na timeline (Interacao tipo SAUDE).
 *
 * Nada é reconstruído: um cliente que nunca teve `saudeStatus` gravado só passa a
 * ter a partir da primeira avaliação, e essa primeira gravação não vira evento —
 * não existiu transição nenhuma, só o começo do monitoramento.
 */
export async function sincronizarHistoricoSaude(
  clientes: { id: string; saudeStatus: string | null; diagnostico: DiagnosticoSaude }[]
): Promise<void> {
  const agora = new Date();

  const mudou = clientes.filter((c) => c.saudeStatus !== c.diagnostico.status);
  if (mudou.length === 0) return;

  await Promise.all(
    mudou.map(async (c) => {
      await prisma.client.update({
        where: { id: c.id },
        data: { saudeStatus: c.diagnostico.status, saudeAvaliadaEm: agora },
      });

      if (!c.saudeStatus) return; // primeira avaliação — começo, não transição

      await prisma.interacao.create({
        data: {
          clienteId: c.id,
          tipo: "SAUDE",
          nota: `${labelSaude(c.saudeStatus as StatusSaude)} → ${labelSaude(c.diagnostico.status)} · ${c.diagnostico.resumo}`,
          ocorreuEm: agora,
        },
      });
    })
  );
}
