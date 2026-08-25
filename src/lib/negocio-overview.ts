// Lógica do painel executivo de /negocio — funções puras, sem dependências de framework.
//
// Recebe listas cruas (leads, receitas, tarefas, compromissos, saúde dos clientes) e
// devolve o modelo que a tela renderiza. Nenhuma regra nova de negócio nasce aqui:
// saúde vem de saude.ts, prazos de compromisso.ts, dinheiro de financeiro.ts.

import { diasParaVencer } from "@/lib/compromisso";
import { diasEmAtraso, fmtBRL, isVencida, type ReceitaLike } from "@/lib/financeiro";
import { DIAS_PARADO_ATENCAO, ESTAGIOS_ATIVOS, labelEstagio } from "@/lib/pipeline";
import type { DiagnosticoSaude, StatusSaude } from "@/lib/saude";

/**
 * Um lead parado há mais dias que isso vira alerta.
 * É o mesmo limiar que colore o card no pipeline — a régua mora em pipeline.ts.
 */
export const DIAS_LEAD_PARADO = DIAS_PARADO_ATENCAO;

export type Severidade = "URGENTE" | "ATENCAO" | "INFO";

// ─── Formatos de entrada ─────────────────────────────────────────────────────

export interface LeadOverview {
  id: string;
  nome: string;
  estagio: string;
  valorEstimadoCentavos: number | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | Date | null;
  atualizadoEm: string | Date;
  /** Desde quando está no estágio atual. Null nas oportunidades anteriores ao campo. */
  estagioDesde?: string | Date | null;
}

export interface CompromissoOverview {
  id: string;
  descricao: string;
  para: string;
  prazoEm: string | Date;
  cumprido: boolean;
}

export interface TarefaOverview {
  id: string;
  title: string;
  dueDate: string | Date | null;
  done: boolean;
  clienteNome: string | null;
}

export interface ReceitaOverview extends ReceitaLike {
  id: string;
  descricao: string;
  valorCentavos: number;
  status: string;
  competencia: string | Date;
  vencimento?: string | Date | null;
  clienteId?: string | null;
  clienteNome: string | null;
}

export interface ClienteSaudeOverview {
  id: string;
  name: string;
  /** Vem inteiro da engine — o painel não recalcula nada por conta própria. */
  diagnostico: DiagnosticoSaude;
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

export interface AlertaNegocio {
  id: string;
  titulo: string;
  detalhe: string;
  severidade: Severidade;
  destino: string;
  destinoLabel: string;
  /** Quanto maior, mais no topo da lista. Normalmente dias de atraso. */
  peso: number;
}

const PESO_SEVERIDADE: Record<Severidade, number> = {
  URGENTE: 2_000_000,
  ATENCAO: 1_000_000,
  INFO: 0,
};

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** "há 4 dias" / "há 1 dia" a partir de um atraso em dias (positivo). */
function haDias(dias: number): string {
  return `há ${plural(dias, "dia", "dias")}`;
}

function diasDesde(data: string | Date, agora: Date): number {
  return Math.floor((agora.getTime() - new Date(data).getTime()) / 86_400_000);
}

export interface DadosAlertas {
  leads: LeadOverview[];
  compromissos: CompromissoOverview[];
  tarefas: TarefaOverview[];
  receitas: ReceitaOverview[];
  clientes: ClienteSaudeOverview[];
}

/**
 * Consolida tudo que pede uma decisão do dono do negócio, do mais urgente ao menos.
 * Só entra na lista o que já está atrasado ou fora do lugar — nunca o que está no prazo.
 */
export function montarAlertas(dados: DadosAlertas, agora = new Date()): AlertaNegocio[] {
  const alertas: AlertaNegocio[] = [];

  // Compromissos vencidos — promessa quebrada com terceiro, o mais grave.
  for (const c of dados.compromissos) {
    if (c.cumprido) continue;
    const dias = diasParaVencer(c.prazoEm);
    if (dias >= 0) continue;
    alertas.push({
      id: `compromisso-${c.id}`,
      titulo: c.descricao,
      detalhe: `prometido para ${c.para} · venceu ${haDias(-dias)}`,
      severidade: "URGENTE",
      destino: "/negocio/compromissos",
      destinoLabel: "Compromissos",
      peso: -dias,
    });
  }

  // Receitas vencidas. Quem decide o que é "vencida" é financeiro.ts — aqui só
  // traduzimos o sinal em alerta, com o mesmo texto que aparece na Saúde.
  for (const r of dados.receitas) {
    if (!isVencida(r, agora)) continue;

    const dias = diasEmAtraso(r, agora);
    alertas.push({
      id: `receita-${r.id}`,
      titulo: r.clienteNome ?? r.descricao,
      detalhe: `${fmtBRL(r.valorCentavos)} vencidos ${haDias(dias)} · ${r.descricao}`,
      severidade: "URGENTE",
      destino: "/negocio/financeiro",
      destinoLabel: "Financeiro",
      peso: dias,
    });
  }

  // Tarefas vencidas.
  for (const t of dados.tarefas) {
    if (t.done || !t.dueDate) continue;
    const dias = diasParaVencer(t.dueDate);
    if (dias >= 0) continue;
    alertas.push({
      id: `tarefa-${t.id}`,
      titulo: t.title,
      detalhe: t.clienteNome
        ? `${t.clienteNome} · venceu ${haDias(-dias)}`
        : `venceu ${haDias(-dias)}`,
      severidade: "URGENTE",
      destino: "/negocio/tarefas",
      destinoLabel: "Tarefas",
      peso: -dias,
    });
  }

  // Leads ativos: próxima ação atrasada, ou parados há muito tempo.
  for (const l of dados.leads) {
    if (!ESTAGIOS_ATIVOS.includes(l.estagio)) continue;

    if (l.proximaAcaoEm) {
      const dias = diasParaVencer(l.proximaAcaoEm);
      if (dias < 0) {
        alertas.push({
          id: `lead-acao-${l.id}`,
          titulo: l.nome,
          detalhe: `${l.proximaAcao ?? "próxima ação"} · atrasada ${haDias(-dias)}`,
          severidade: "URGENTE",
          destino: "/negocio/pipeline",
          destinoLabel: "Pipeline",
          peso: -dias,
        });
        continue;
      }
    }

    const parado = diasDesde(l.estagioDesde ?? l.atualizadoEm, agora);
    if (parado >= DIAS_LEAD_PARADO) {
      alertas.push({
        id: `lead-parado-${l.id}`,
        titulo: l.nome,
        detalhe: `parado em ${labelEstagio(l.estagio)} ${haDias(parado)}`,
        severidade: "ATENCAO",
        destino: "/negocio/pipeline",
        destinoLabel: "Pipeline",
        peso: parado,
      });
    }
  }

  // Saúde dos clientes — o diagnóstico inteiro vem da engine (saude.ts).
  //
  // Só entram aqui os motivos que ninguém mais conta: tarefa vencida, receita
  // atrasada, compromisso e oportunidade parada já viraram alerta próprio acima, e
  // repeti-los como "cliente em risco" seria dizer a mesma coisa duas vezes.
  for (const c of dados.clientes) {
    const { status, motivos, score } = c.diagnostico;
    if (status !== "VERMELHO" && status !== "AMARELO") continue;

    const proprio = motivos.find((m) => !m.temAlertaProprio);
    if (!proprio) continue;

    alertas.push({
      id: `saude-${c.id}`,
      titulo: c.name,
      detalhe: proprio.texto.toLowerCase(),
      severidade: status === "VERMELHO" ? "URGENTE" : "ATENCAO",
      destino: "/negocio/saude",
      destinoLabel: "Saúde",
      // Quanto pior o score, mais alto na lista dentro da mesma severidade.
      peso: 100 - score,
    });
  }

  return alertas.sort(
    (a, b) =>
      PESO_SEVERIDADE[b.severidade] + b.peso - (PESO_SEVERIDADE[a.severidade] + a.peso)
  );
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export interface EstagioResumo {
  estagio: string;
  label: string;
  quantidade: number;
  valorCentavos: number;
}

export interface PipelineResumo {
  totalCentavos: number;
  quantidade: number;
  estagios: EstagioResumo[];
}

/** Soma e distribui por estágio apenas os leads ainda em aberto. */
export function resumirPipeline(leads: LeadOverview[]): PipelineResumo {
  const estagios: EstagioResumo[] = ESTAGIOS_ATIVOS.map((estagio) => ({
    estagio,
    label: labelEstagio(estagio),
    quantidade: 0,
    valorCentavos: 0,
  }));

  let totalCentavos = 0;
  let quantidade = 0;

  for (const lead of leads) {
    const alvo = estagios.find((e) => e.estagio === lead.estagio);
    if (!alvo) continue;
    const valor = lead.valorEstimadoCentavos ?? 0;
    alvo.quantidade += 1;
    alvo.valorCentavos += valor;
    totalCentavos += valor;
    quantidade += 1;
  }

  return { totalCentavos, quantidade, estagios };
}

// ─── Saúde dos clientes ──────────────────────────────────────────────────────

export interface SaudeResumo {
  vermelho: number;
  amarelo: number;
  verde: number;
  /** Cliente novo ou sem histórico suficiente — nem saudável, nem problema. */
  semDados: number;
  total: number;
  /** Receita recorrente presa em clientes em risco ou em atenção. */
  mrrEmRiscoCentavos: number;
}

const CHAVE_RESUMO: Record<StatusSaude, keyof Omit<SaudeResumo, "total" | "mrrEmRiscoCentavos">> = {
  VERMELHO: "vermelho",
  AMARELO: "amarelo",
  VERDE: "verde",
  SEM_DADOS: "semDados",
};

export function resumirSaude(clientes: ClienteSaudeOverview[]): SaudeResumo {
  const resumo: SaudeResumo = {
    vermelho: 0,
    amarelo: 0,
    verde: 0,
    semDados: 0,
    total: clientes.length,
    mrrEmRiscoCentavos: 0,
  };
  for (const c of clientes) {
    const { status, mrrCentavos } = c.diagnostico;
    resumo[CHAVE_RESUMO[status]] += 1;
    if (status === "VERMELHO" || status === "AMARELO") {
      resumo.mrrEmRiscoCentavos += mrrCentavos;
    }
  }
  return resumo;
}

// ─── Próximos ────────────────────────────────────────────────────────────────

export interface ProximoItem {
  id: string;
  titulo: string;
  tipo: "Compromisso" | "Tarefa";
  quando: string;
  dias: number;
  destino: string;
}

/** Rótulo curto de prazo para os próximos dias. */
export function fmtQuando(data: string | Date): string {
  const dias = diasParaVencer(data);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias < 7) return `Em ${plural(dias, "dia", "dias")}`;
  return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Tarefas e compromissos que ainda vão vencer, do mais próximo ao mais distante.
 * O que já venceu não aparece aqui — vive na lista de alertas.
 */
export function montarProximos(
  tarefas: TarefaOverview[],
  compromissos: CompromissoOverview[],
  limite = 5
): ProximoItem[] {
  const itens: ProximoItem[] = [];

  for (const c of compromissos) {
    if (c.cumprido) continue;
    const dias = diasParaVencer(c.prazoEm);
    if (dias < 0) continue;
    itens.push({
      id: `compromisso-${c.id}`,
      titulo: c.descricao,
      tipo: "Compromisso",
      quando: fmtQuando(c.prazoEm),
      dias,
      destino: "/negocio/compromissos",
    });
  }

  for (const t of tarefas) {
    if (t.done || !t.dueDate) continue;
    const dias = diasParaVencer(t.dueDate);
    if (dias < 0) continue;
    itens.push({
      id: `tarefa-${t.id}`,
      titulo: t.title,
      tipo: "Tarefa",
      quando: fmtQuando(t.dueDate),
      dias,
      destino: "/negocio/tarefas",
    });
  }

  return itens.sort((a, b) => a.dias - b.dias).slice(0, limite);
}

// ─── Valor a receber já vencido ──────────────────────────────────────────────

/**
 * Total vencido dentro do "a receber". Delega a régua para financeiro.ts: o
 * painel, a tela de Financeiro e a Saúde precisam concordar no mesmo número.
 */
export function calcAReceberVencido(receitas: ReceitaOverview[], agora = new Date()): number {
  return receitas
    .filter((r) => isVencida(r, agora))
    .reduce((soma, r) => soma + r.valorCentavos, 0);
}
