import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { type DiagnosticoSaude, type StatusSaude } from "@/lib/saude";
import { diagnosticarCliente } from "@/lib/saude-server";
import { montarAlertas, type AlertaNegocio } from "@/lib/negocio-overview";
import {
  calcMetricasCliente,
  montarTimeline,
  ultimoContato,
  type CompromissoCliente,
  type EventoTimeline,
  type InteracaoCliente,
  type LeadCliente,
  type MetricasCliente,
  type ReceitaCliente,
  type TarefaCliente,
} from "@/lib/cliente-360";

export interface ClienteOverview {
  cliente: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    instagram: string | null;
    company: string | null;
    notes: string | null;
    status: string;
    source: string | null;
    tags: string | null;
    saudeNota: string | null;
    createdAt: string;
    arquivadoEm: string | null;
    ultimoContatoEm: string | null;
  };
  saude: StatusSaude;
  /** O diagnóstico inteiro — motivos, sinais positivos, ação e contexto. */
  diagnostico: DiagnosticoSaude;
  metricas: MetricasCliente;
  alertas: AlertaNegocio[];
  timeline: EventoTimeline[];
  leads: LeadCliente[];
  tarefas: TarefaCliente[];
  compromissos: CompromissoCliente[];
  receitas: ReceitaCliente[];
  interacoes: InteracaoCliente[];
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      receitas: { orderBy: { competencia: "desc" } },
      leads: { orderBy: { criadoEm: "desc" } },
      tasks: { orderBy: [{ done: "asc" }, { dueDate: "asc" }] },
      compromissos: { orderBy: [{ cumprido: "asc" }, { prazoEm: "asc" }] },
      interacoes: { orderBy: { ocorreuEm: "desc" } },
    },
  });

  if (!c) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Mesma engine da lista, da tela de Saúde e do painel — nada recalculado aqui.
  const diagnostico = diagnosticarCliente(c);
  const saude = diagnostico.status;

  const receitas: ReceitaCliente[] = c.receitas.map((r) => ({
    id: r.id,
    descricao: r.descricao,
    valorCentavos: r.valorCentavos,
    linha: r.linha,
    tipo: r.tipo,
    status: r.status,
    competencia: r.competencia.toISOString(),
    vencimento: r.vencimento?.toISOString() ?? null,
    dataRecebida: r.dataRecebida?.toISOString() ?? null,
    criadoEm: r.criadoEm.toISOString(),
  }));

  const leads: LeadCliente[] = c.leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    estagio: l.estagio,
    valorEstimadoCentavos: l.valorEstimadoCentavos,
    proximaAcao: l.proximaAcao,
    proximaAcaoEm: l.proximaAcaoEm?.toISOString() ?? null,
    criadoEm: l.criadoEm.toISOString(),
    atualizadoEm: l.atualizadoEm.toISOString(),
  }));

  const tarefas: TarefaCliente[] = c.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate?.toISOString() ?? null,
    done: t.done,
    concluidaEm: t.concluidaEm?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));

  const compromissos: CompromissoCliente[] = c.compromissos.map((k) => ({
    id: k.id,
    descricao: k.descricao,
    prazoEm: k.prazoEm.toISOString(),
    cumprido: k.cumprido,
    cumpridoEm: k.cumpridoEm?.toISOString() ?? null,
    criadoEm: k.criadoEm.toISOString(),
  }));

  const interacoes: InteracaoCliente[] = c.interacoes.map((i) => ({
    id: i.id,
    tipo: i.tipo,
    nota: i.nota,
    ocorreuEm: i.ocorreuEm.toISOString(),
  }));

  // Alertas: exatamente as mesmas regras do dashboard, com os dados deste cliente.
  const alertas = montarAlertas({
    leads: leads.map((l) => ({
      id: l.id,
      nome: l.nome,
      estagio: l.estagio,
      valorEstimadoCentavos: l.valorEstimadoCentavos,
      proximaAcao: l.proximaAcao,
      proximaAcaoEm: l.proximaAcaoEm,
      atualizadoEm: l.atualizadoEm,
    })),
    compromissos: compromissos.map((k) => ({
      id: k.id,
      descricao: k.descricao,
      para: c.name,
      prazoEm: k.prazoEm,
      cumprido: k.cumprido,
    })),
    tarefas: tarefas.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      done: t.done,
      clienteNome: c.name,
    })),
    receitas: receitas
      .filter((r) => r.status !== "RECEBIDA")
      .map((r) => ({
        id: r.id,
        descricao: r.descricao,
        valorCentavos: r.valorCentavos,
        tipo: r.tipo,
        status: r.status,
        competencia: r.competencia,
        vencimento: r.vencimento,
        clienteNome: c.name,
      })),
    clientes: [{ id: c.id, name: c.name, diagnostico }],
  });

  const overview: ClienteOverview = {
    cliente: {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      instagram: c.instagram,
      company: c.company,
      notes: c.notes,
      status: c.status,
      source: c.source,
      tags: c.tags,
      saudeNota: c.saudeNota,
      createdAt: c.createdAt.toISOString(),
      arquivadoEm: c.arquivadoEm?.toISOString() ?? null,
      ultimoContatoEm: ultimoContato(c.ultimoContatoEm, interacoes),
    },
    saude,
    diagnostico,
    metricas: calcMetricasCliente({ criadoEm: c.createdAt, receitas, leads, tarefas }),
    alertas,
    timeline: montarTimeline({
      clienteNome: c.name,
      criadoEm: c.createdAt,
      interacoes,
      leads,
      tarefas,
      compromissos,
      receitas,
    }),
    leads,
    tarefas,
    compromissos,
    receitas,
    interacoes,
  };

  return NextResponse.json(overview);
}
