import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcResumoPipeline, type ResumoPipeline } from "@/lib/pipeline";

/**
 * Tudo que o pipeline precisa, em 3 queries fixas — nunca uma por card.
 *
 * A próxima ação de cada oportunidade sai, nesta ordem:
 *   1. do campo do próprio Lead (é obrigatório em estágio ativo e é o mais específico);
 *   2. da tarefa ou compromisso em aberto do cliente vinculado, o que vencer antes.
 * Nenhuma estrutura nova de "próxima ação" foi criada — são os registros que já existem.
 */

export interface ProximaAcaoOportunidade {
  titulo: string;
  em: string | null;
  /** LEAD = campo da própria oportunidade; TAREFA / COMPROMISSO = do cliente. */
  origem: "LEAD" | "TAREFA" | "COMPROMISSO";
}

export interface LeadPipeline {
  id: string;
  nome: string;
  contato: string;
  estagio: string;
  origem: string;
  linhaInteresse: string;
  valorEstimadoCentavos: number | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  notas: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  estagioDesde: string | null;
  motivoPerda: string | null;
  notaPerda: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Derivada — ver a regra no topo do arquivo. */
  acao: ProximaAcaoOportunidade | null;
  /**
   * Quantas receitas este fechamento já gerou. É a trava de duplicação vista do
   * lado do Pipeline: com receita gerada, fechar de novo não oferece criar outra.
   */
  receitasGeradas: number;
}

export interface PipelineOverview {
  leads: LeadPipeline[];
  resumo: ResumoPipeline;
}

export async function GET() {
  const leads = await prisma.lead.findMany({
    orderBy: [{ estagio: "asc" }, { proximaAcaoEm: "asc" }],
    include: {
      cliente: { select: { id: true, name: true } },
      _count: { select: { receitas: true } },
    },
  });

  const clienteIds = [...new Set(leads.map((l) => l.clienteId).filter((v): v is string => !!v))];

  // Duas queries em lote — não uma por oportunidade.
  const [tarefas, compromissos] = clienteIds.length
    ? await Promise.all([
        prisma.task.findMany({
          where: { done: false, clientId: { in: clienteIds }, dueDate: { not: null } },
          select: { id: true, title: true, dueDate: true, clientId: true },
          orderBy: { dueDate: "asc" },
        }),
        prisma.compromisso.findMany({
          where: { cumprido: false, clienteId: { in: clienteIds } },
          select: { id: true, descricao: true, prazoEm: true, clienteId: true },
          orderBy: { prazoEm: "asc" },
        }),
      ])
    : [[], []];

  // Como as duas listas já vêm ordenadas por data, o primeiro de cada cliente é o
  // mais próximo de vencer.
  const primeiraTarefa = new Map<string, { titulo: string; em: Date }>();
  for (const t of tarefas) {
    if (!t.clientId || !t.dueDate || primeiraTarefa.has(t.clientId)) continue;
    primeiraTarefa.set(t.clientId, { titulo: t.title, em: t.dueDate });
  }

  const primeiroCompromisso = new Map<string, { titulo: string; em: Date }>();
  for (const c of compromissos) {
    if (!c.clienteId || primeiroCompromisso.has(c.clienteId)) continue;
    primeiroCompromisso.set(c.clienteId, { titulo: c.descricao, em: c.prazoEm });
  }

  function derivarAcao(lead: (typeof leads)[number]): ProximaAcaoOportunidade | null {
    if (lead.proximaAcao?.trim()) {
      return {
        titulo: lead.proximaAcao.trim(),
        em: lead.proximaAcaoEm?.toISOString() ?? null,
        origem: "LEAD",
      };
    }

    if (!lead.clienteId) return null;

    const tarefa = primeiraTarefa.get(lead.clienteId);
    const compromisso = primeiroCompromisso.get(lead.clienteId);

    const candidatos: ProximaAcaoOportunidade[] = [];
    if (tarefa) candidatos.push({ titulo: tarefa.titulo, em: tarefa.em.toISOString(), origem: "TAREFA" });
    if (compromisso) {
      candidatos.push({
        titulo: compromisso.titulo,
        em: compromisso.em.toISOString(),
        origem: "COMPROMISSO",
      });
    }
    if (candidatos.length === 0) return null;

    candidatos.sort((a, b) => (a.em ?? "").localeCompare(b.em ?? ""));
    return candidatos[0];
  }

  const overview: PipelineOverview = {
    leads: leads.map((l) => ({
      id: l.id,
      nome: l.nome,
      contato: l.contato,
      estagio: l.estagio,
      origem: l.origem,
      linhaInteresse: l.linhaInteresse,
      valorEstimadoCentavos: l.valorEstimadoCentavos,
      proximaAcao: l.proximaAcao,
      proximaAcaoEm: l.proximaAcaoEm?.toISOString() ?? null,
      notas: l.notas,
      clienteId: l.clienteId,
      clienteNome: l.cliente?.name ?? null,
      estagioDesde: l.estagioDesde?.toISOString() ?? null,
      motivoPerda: l.motivoPerda,
      notaPerda: l.notaPerda,
      criadoEm: l.criadoEm.toISOString(),
      atualizadoEm: l.atualizadoEm.toISOString(),
      acao: derivarAcao(l),
      receitasGeradas: l._count.receitas,
    })),
    resumo: calcResumoPipeline(leads),
  };

  return NextResponse.json(overview);
}
