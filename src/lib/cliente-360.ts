// Lógica do perfil 360° do cliente — funções puras, sem dependências de framework.
//
// Nada de regra nova: saúde vem de saude.ts, prazos de compromisso.ts, dinheiro de
// financeiro.ts e os alertas de negocio-overview.ts (as mesmas regras do dashboard,
// só que com os dados de um cliente).

import { diasParaVencer } from "@/lib/compromisso";
import {
  calcAReceber,
  calcMRR,
  calcRecebido,
  calcVencido,
  contaComoReceita,
  isRecebida,
} from "@/lib/financeiro";
import { ultimoContatoEmMs } from "@/lib/saude";

/** Tipos de interação. STATUS e SAUDE são gravados pelo sistema; o resto é manual. */
export const TIPOS_INTERACAO = [
  "LIGACAO",
  "WHATSAPP",
  "EMAIL",
  "REUNIAO",
  "OUTRO",
  "NOTA",
  "STATUS",
  "SAUDE",
] as const;
export type TipoInteracao = (typeof TIPOS_INTERACAO)[number];

/** Os que aparecem no seletor de "Registrar interação" — os do sistema não são escolhíveis. */
export const TIPOS_MANUAIS: TipoInteracao[] = [
  "LIGACAO",
  "WHATSAPP",
  "EMAIL",
  "REUNIAO",
  "OUTRO",
  "NOTA",
];

export const LABEL_INTERACAO: Record<string, string> = {
  LIGACAO: "Ligação",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  OUTRO: "Outro contato",
  NOTA: "Observação",
  STATUS: "Status",
  SAUDE: "Saúde",
};

export function isTipoInteracao(v: string): v is TipoInteracao {
  return (TIPOS_INTERACAO as readonly string[]).includes(v);
}

// ─── Formatação de datas ─────────────────────────────────────────────────────

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function diaMes(data: Date): string {
  return `${data.getUTCDate()} ${MESES[data.getUTCMonth()]}`;
}

/** Passado em linguagem humana: "Hoje", "Ontem", "há 4 dias", "12 ago". */
export function fmtDataHumana(data: string | Date | null): string {
  if (!data) return "—";
  const d = new Date(data);
  const dias = -diasParaVencer(d);
  if (dias < 0) return diaMes(d);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return `há ${dias} dias`;
  return diaMes(d);
}

/** Futuro curto: "hoje", "amanhã", "em 3 dias", "27 ago". */
export function fmtPrazoCurto(data: string | Date): string {
  const d = new Date(data);
  const dias = diasParaVencer(d);
  if (dias < 0) return `atrasado ${Math.abs(dias)}d`;
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias < 7) return `em ${dias} dias`;
  return diaMes(d);
}

/** "Mar 2026" — usado no "Cliente desde". */
export function fmtMesAno(data: string | Date): string {
  const d = new Date(data);
  const mes = MESES[d.getUTCMonth()];
  return `${mes[0].toUpperCase()}${mes.slice(1)} ${d.getUTCFullYear()}`;
}

// ─── Métricas ────────────────────────────────────────────────────────────────

export interface ReceitaCliente {
  id: string;
  descricao: string;
  valorCentavos: number;
  linha: string;
  tipo: string;
  status: string;
  competencia: string | Date;
  vencimento: string | Date | null;
  dataRecebida: string | Date | null;
  criadoEm: string | Date;
}

export interface LeadCliente {
  id: string;
  nome: string;
  estagio: string;
  valorEstimadoCentavos: number | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | Date | null;
  criadoEm: string | Date;
  atualizadoEm: string | Date;
}

export interface TarefaCliente {
  id: string;
  title: string;
  dueDate: string | Date | null;
  done: boolean;
  concluidaEm: string | Date | null;
  createdAt: string | Date;
}

export interface CompromissoCliente {
  id: string;
  descricao: string;
  prazoEm: string | Date;
  cumprido: boolean;
  cumpridoEm: string | Date | null;
  criadoEm: string | Date;
}

export interface InteracaoCliente {
  id: string;
  tipo: string;
  nota: string;
  ocorreuEm: string | Date;
}

export interface MetricasCliente {
  /** Recorrente contratada e em dia na competência do mês atual. */
  mrrCentavos: number;
  /** Tudo que já entrou de fato (status RECEBIDA), qualquer competência. */
  receitaTotalCentavos: number;
  /** Ainda não recebida e não cancelada, qualquer competência. */
  aReceberCentavos: number;
  /** A fatia do a receber que já passou do vencimento. */
  vencidoCentavos: number;
  oportunidadesAbertas: number;
  tarefasAbertas: number;
  clienteDesde: string;
}

const ESTAGIOS_ABERTOS = ["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO"];

export function calcMetricasCliente(dados: {
  criadoEm: string | Date;
  receitas: ReceitaCliente[];
  leads: LeadCliente[];
  tarefas: TarefaCliente[];
  agora?: Date;
}): MetricasCliente {
  const agora = dados.agora ?? new Date();
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const fimMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));

  // As mesmas funções do Financeiro e do painel — o cliente não tem régua própria.
  const doMes = dados.receitas.filter((r) => {
    const c = new Date(r.competencia);
    return c >= inicioMes && c < fimMes;
  });

  return {
    mrrCentavos: calcMRR(doMes, agora),
    receitaTotalCentavos: calcRecebido(dados.receitas),
    aReceberCentavos: calcAReceber(dados.receitas),
    vencidoCentavos: calcVencido(dados.receitas, agora),
    oportunidadesAbertas: dados.leads.filter((l) => ESTAGIOS_ABERTOS.includes(l.estagio)).length,
    tarefasAbertas: dados.tarefas.filter((t) => !t.done).length,
    clienteDesde: fmtMesAno(dados.criadoEm),
  };
}

/**
 * Os últimos pagamentos que efetivamente entraram, do mais recente ao mais
 * antigo. Só receitas com data de recebimento — nada é inferido.
 */
export function ultimosPagamentos(receitas: ReceitaCliente[], limite = 3): ReceitaCliente[] {
  return receitas
    .filter((r) => isRecebida(r) && r.dataRecebida)
    .sort(
      (a, b) => new Date(b.dataRecebida!).getTime() - new Date(a.dataRecebida!).getTime()
    )
    .slice(0, limite);
}

/** Receitas do cliente que ainda contam — canceladas somem da visão do perfil. */
export function receitasVigentes(receitas: ReceitaCliente[]): ReceitaCliente[] {
  return receitas.filter(contaComoReceita);
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export type TipoEvento =
  | "CLIENTE_CRIADO"
  | "INTERACAO"
  | "OPORTUNIDADE_CRIADA"
  | "TAREFA_CRIADA"
  | "TAREFA_CONCLUIDA"
  | "COMPROMISSO_CRIADO"
  | "COMPROMISSO_CUMPRIDO"
  | "RECEITA_REGISTRADA"
  | "RECEITA_RECEBIDA";

export interface EventoTimeline {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  detalhe: string;
  em: string;
}

function iso(d: string | Date): string {
  return new Date(d).toISOString();
}

/**
 * Timeline do relacionamento, montada só a partir de carimbos de data que existem
 * de verdade no banco. Nada é reconstruído retroativamente: uma tarefa concluída
 * antes desta migração não tem `concluidaEm` e por isso não vira evento.
 */
export function montarTimeline(dados: {
  clienteNome: string;
  criadoEm: string | Date;
  interacoes: InteracaoCliente[];
  leads: LeadCliente[];
  tarefas: TarefaCliente[];
  compromissos: CompromissoCliente[];
  receitas: ReceitaCliente[];
}): EventoTimeline[] {
  const eventos: EventoTimeline[] = [];

  eventos.push({
    id: "criado",
    tipo: "CLIENTE_CRIADO",
    titulo: "Cliente cadastrado",
    detalhe: dados.clienteNome,
    em: iso(dados.criadoEm),
  });

  for (const i of dados.interacoes) {
    eventos.push({
      id: `interacao-${i.id}`,
      tipo: "INTERACAO",
      titulo: LABEL_INTERACAO[i.tipo] ?? i.tipo,
      detalhe: i.nota,
      em: iso(i.ocorreuEm),
    });
  }

  for (const l of dados.leads) {
    eventos.push({
      id: `lead-${l.id}`,
      tipo: "OPORTUNIDADE_CRIADA",
      titulo: "Oportunidade criada",
      detalhe: l.nome,
      em: iso(l.criadoEm),
    });
  }

  for (const t of dados.tarefas) {
    eventos.push({
      id: `tarefa-criada-${t.id}`,
      tipo: "TAREFA_CRIADA",
      titulo: "Tarefa criada",
      detalhe: t.title,
      em: iso(t.createdAt),
    });
    if (t.concluidaEm) {
      eventos.push({
        id: `tarefa-feita-${t.id}`,
        tipo: "TAREFA_CONCLUIDA",
        titulo: "Tarefa concluída",
        detalhe: t.title,
        em: iso(t.concluidaEm),
      });
    }
  }

  for (const c of dados.compromissos) {
    eventos.push({
      id: `compromisso-criado-${c.id}`,
      tipo: "COMPROMISSO_CRIADO",
      titulo: "Compromisso assumido",
      detalhe: c.descricao,
      em: iso(c.criadoEm),
    });
    if (c.cumpridoEm) {
      eventos.push({
        id: `compromisso-feito-${c.id}`,
        tipo: "COMPROMISSO_CUMPRIDO",
        titulo: "Compromisso cumprido",
        detalhe: c.descricao,
        em: iso(c.cumpridoEm),
      });
    }
  }

  for (const r of dados.receitas) {
    eventos.push({
      id: `receita-${r.id}`,
      tipo: "RECEITA_REGISTRADA",
      titulo: "Receita registrada",
      detalhe: r.descricao,
      em: iso(r.criadoEm),
    });
    if (r.dataRecebida) {
      eventos.push({
        id: `receita-paga-${r.id}`,
        tipo: "RECEITA_RECEBIDA",
        titulo: "Pagamento recebido",
        detalhe: r.descricao,
        em: iso(r.dataRecebida),
      });
    }
  }

  return eventos.sort((a, b) => b.em.localeCompare(a.em));
}

// ─── Próxima ação (coluna da lista) ──────────────────────────────────────────

export interface ProximaAcaoCliente {
  titulo: string;
  quando: string;
  atrasado: boolean;
}

/**
 * A coisa mais próxima a fazer por este cliente: tarefa ou compromisso em aberto,
 * o que vencer primeiro. Sem nada em aberto, devolve null (a coluna mostra "—").
 */
export function proximaAcaoDoCliente(
  tarefas: { title: string; dueDate: string | Date | null; done: boolean }[],
  compromissos: { descricao: string; prazoEm: string | Date; cumprido: boolean }[]
): ProximaAcaoCliente | null {
  const candidatos: { titulo: string; em: Date }[] = [];

  for (const t of tarefas) {
    if (t.done || !t.dueDate) continue;
    candidatos.push({ titulo: t.title, em: new Date(t.dueDate) });
  }
  for (const c of compromissos) {
    if (c.cumprido) continue;
    candidatos.push({ titulo: c.descricao, em: new Date(c.prazoEm) });
  }

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => a.em.getTime() - b.em.getTime());
  const proximo = candidatos[0];

  return {
    titulo: proximo.titulo,
    quando: fmtPrazoCurto(proximo.em),
    atrasado: diasParaVencer(proximo.em) < 0,
  };
}

/**
 * Data do contato mais recente: o campo manual ou a última interação de contato.
 *
 * A régua de "o que conta como contato" mora na engine (TIPOS_CONTATO em saude.ts):
 * observação interna e evento de sistema não são conversa com o cliente.
 */
export function ultimoContato(
  ultimoContatoEm: string | Date | null,
  interacoes: InteracaoCliente[]
): string | null {
  const ms = ultimoContatoEmMs(ultimoContatoEm, interacoes);
  return ms === null ? null : new Date(ms).toISOString();
}
