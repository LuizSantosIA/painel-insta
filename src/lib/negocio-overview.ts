// Lógica do painel executivo de /negocio — funções puras, sem dependências de framework.
//
// Recebe listas cruas (leads, receitas, tarefas, compromissos, saúde dos clientes) e
// devolve o modelo que a tela renderiza. Nenhuma regra nova de negócio nasce aqui:
// saúde vem de saude.ts, prazos de compromisso.ts, dinheiro de financeiro.ts.

import { diasParaVencer } from "@/lib/compromisso";
import { ESTAGIOS_ATIVOS, labelEstagio } from "@/lib/pipeline";
import type { SaudeScore } from "@/lib/saude";

/** Um lead parado há mais dias que isso vira alerta. */
export const DIAS_LEAD_PARADO = 7;

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

export interface ReceitaOverview {
  id: string;
  descricao: string;
  valorCentavos: number;
  status: string;
  competencia: string | Date;
  clienteNome: string | null;
}

export interface ClienteSaudeOverview {
  id: string;
  name: string;
  saude: SaudeScore;
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

/** Início do mês corrente em UTC — a fronteira que define receita vencida. */
function inicioDoMes(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
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

  // Receitas não recebidas com competência anterior ao mês atual.
  const limiteMes = inicioDoMes(agora);
  for (const r of dados.receitas) {
    const vencida = new Date(r.competencia) < limiteMes && r.status !== "RECEBIDA";
    const inadimplente = r.status === "INADIMPLENTE";
    if (!vencida && !inadimplente) continue;

    const dias = diasDesde(r.competencia, agora);
    alertas.push({
      id: `receita-${r.id}`,
      titulo: r.clienteNome ?? r.descricao,
      detalhe: inadimplente
        ? `pagamento inadimplente · ${r.descricao}`
        : `receita não recebida ${haDias(Math.max(dias, 1))}`,
      severidade: "URGENTE",
      destino: "/negocio/financeiro",
      destinoLabel: "Financeiro",
      peso: Math.max(dias, 1),
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

    const parado = diasDesde(l.atualizadoEm, agora);
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

  // Saúde dos clientes — o cálculo em si mora em saude.ts.
  for (const c of dados.clientes) {
    if (c.saude === "VERDE") continue;
    alertas.push({
      id: `saude-${c.id}`,
      titulo: c.name,
      detalhe: c.saude === "VERMELHO" ? "cliente em risco" : "cliente precisa de atenção",
      severidade: c.saude === "VERMELHO" ? "URGENTE" : "ATENCAO",
      destino: "/negocio/saude",
      destinoLabel: "Saúde",
      peso: c.saude === "VERMELHO" ? 5 : 1,
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
  total: number;
}

export function resumirSaude(clientes: ClienteSaudeOverview[]): SaudeResumo {
  const resumo: SaudeResumo = { vermelho: 0, amarelo: 0, verde: 0, total: clientes.length };
  for (const c of clientes) {
    if (c.saude === "VERMELHO") resumo.vermelho += 1;
    else if (c.saude === "AMARELO") resumo.amarelo += 1;
    else resumo.verde += 1;
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

// ─── Pipeline: valor a receber vencido ───────────────────────────────────────

/** Total já vencido dentro do "a receber" — competência passada e ainda não recebida. */
export function calcAReceberVencido(receitas: ReceitaOverview[], agora = new Date()): number {
  const limite = inicioDoMes(agora);
  return receitas
    .filter((r) => r.status !== "RECEBIDA" && new Date(r.competencia) < limite)
    .reduce((soma, r) => soma + r.valorCentavos, 0);
}
