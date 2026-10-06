// Lógica da Máquina (sistema de aquisição) — funções puras, sem dependência de framework.
//
// A Máquina responde uma pergunta só: "o que estou fazendo para gerar negócio e o
// que está funcionando?". O fluxo conceitual é
//
//   CONTEÚDO → CONVERSA → LEAD → OPORTUNIDADE → CLIENTE → RECEITA
//
// Nada aqui inventa atribuição. Quando a cadeia não pode ser medida com os dados
// que temos, a etapa devolve `valor: null` e diz por quê — é melhor mostrar
// "não sabemos" do que um número bonito e falso.

import { ESTAGIOS_ATIVOS } from "@/lib/pipeline";
import type { AlertaNegocio, Severidade } from "@/lib/negocio-overview";

export type { Severidade };
/** A Máquina usa o mesmo formato de alerta do Negócio — a lista na tela é a mesma. */
export type AlertaMaquina = AlertaNegocio;

// ─── Conteúdo ────────────────────────────────────────────────────────────────

export const STATUS_CONTEUDO = ["IDEIA", "RASCUNHO", "AGENDADO", "PUBLICADO"] as const;
export type StatusConteudo = (typeof STATUS_CONTEUDO)[number];

export const LABEL_STATUS_CONTEUDO: Record<string, string> = {
  IDEIA: "Ideia",
  RASCUNHO: "Rascunho",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
};

export const COR_STATUS_CONTEUDO: Record<string, string> = {
  IDEIA: "#6b81a8",
  RASCUNHO: "#7C5CFF",
  AGENDADO: "#F59E0B",
  PUBLICADO: "#22C55E",
};

export function labelStatusConteudo(status: string): string {
  return LABEL_STATUS_CONTEUDO[status] ?? status;
}

export function isStatusConteudo(v: unknown): v is StatusConteudo {
  return typeof v === "string" && (STATUS_CONTEUDO as readonly string[]).includes(v);
}

// ─── Conversas ───────────────────────────────────────────────────────────────

/**
 * Estado de uma conversa do ponto de vista de quem precisa agir.
 * NOVA tem precedência sobre AGUARDANDO_VOCE: ali eu nunca respondi nada.
 */
export type StatusConversa =
  | "NOVA"
  | "AGUARDANDO_VOCE"
  | "AGUARDANDO_CONTATO"
  | "LEAD"
  | "OPORTUNIDADE";

export const LABEL_STATUS_CONVERSA: Record<StatusConversa, string> = {
  NOVA: "Nova",
  AGUARDANDO_VOCE: "Aguardando você",
  AGUARDANDO_CONTATO: "Aguardando contato",
  LEAD: "Lead identificado",
  OPORTUNIDADE: "Oportunidade",
};

export const COR_STATUS_CONVERSA: Record<StatusConversa, string> = {
  NOVA: "#00D4FF",
  AGUARDANDO_VOCE: "#F59E0B",
  AGUARDANDO_CONTATO: "#6b81a8",
  LEAD: "#4F8CFF",
  OPORTUNIDADE: "#22C55E",
};

export interface ConversaClassificavel {
  /** Estágio do lead vinculado a esta conversa; null quando ainda não virou lead. */
  estagioLead: string | null;
  /** true = a última mensagem é minha; false = é do contato; null = sem mensagens. */
  ultimaMinha: boolean | null;
  /** Quantas mensagens minhas existem na thread. */
  minhas: number;
}

export function classificarConversa(c: ConversaClassificavel): StatusConversa {
  if (c.estagioLead) {
    // LEAD é o primeiro estágio do pipeline; de QUALIFICADO em diante virou oportunidade.
    return c.estagioLead === "LEAD" ? "LEAD" : "OPORTUNIDADE";
  }
  if (c.ultimaMinha === null || c.minhas === 0) return "NOVA";
  return c.ultimaMinha ? "AGUARDANDO_CONTATO" : "AGUARDANDO_VOCE";
}

/** Conversas que dependem de uma resposta minha — o número que vale para o dia. */
export function contarAguardandoResposta(status: StatusConversa[]): number {
  return status.filter((s) => s === "NOVA" || s === "AGUARDANDO_VOCE").length;
}

// ─── Atribuição por conteúdo ─────────────────────────────────────────────────

/**
 * O que conseguimos amarrar a um conteúdo específico.
 *
 * A cadeia real hoje é: CommentLog.igPostId = Post.igId (comentário que disparou
 * automação) → CommentLog.senderId = IgConversation.igUserId (a conversa que nasceu
 * dali) → Lead.postOrigemId / Lead.conversaId → Lead.clienteId → Receita.clienteId.
 * Cada elo que não existir vira 0, nunca uma estimativa.
 */
export interface AtribuicaoConteudo {
  /** Comentários que dispararam alguma automação neste post. */
  automacoes: number;
  /** DMs efetivamente enviadas pela automação. */
  dmsEnviadas: number;
  /** Conversas no direct com pessoas que comentaram neste post. */
  conversas: number;
  leads: number;
  oportunidades: number;
  clientes: number;
  receitaCentavos: number;
}

export function atribuicaoVazia(): AtribuicaoConteudo {
  return {
    automacoes: 0,
    dmsEnviadas: 0,
    conversas: 0,
    leads: 0,
    oportunidades: 0,
    clientes: 0,
    receitaCentavos: 0,
  };
}

/** Um lead deixou de ser só lead? É o que conta como oportunidade. */
export function ehOportunidade(estagio: string): boolean {
  return estagio !== "LEAD" && estagio !== "PERDIDO";
}

/** Está aberto no pipeline (nem fechado, nem perdido). */
export function ehAtivo(estagio: string): boolean {
  return ESTAGIOS_ATIVOS.includes(estagio);
}

export type MetricaConteudo =
  | "leads"
  | "conversas"
  | "oportunidades"
  | "receita"
  | "interacoes"
  | "alcance";

export const METRICAS_CONTEUDO: { chave: MetricaConteudo; label: string }[] = [
  { chave: "leads", label: "Leads" },
  { chave: "conversas", label: "Conversas" },
  { chave: "oportunidades", label: "Oportunidades" },
  { chave: "receita", label: "Receita" },
  { chave: "interacoes", label: "Interações" },
  { chave: "alcance", label: "Alcance" },
];

export interface ConteudoOrdenavel {
  atribuicao: AtribuicaoConteudo;
  interacoes: number;
  alcance: number;
}

export function valorDaMetrica(c: ConteudoOrdenavel, metrica: MetricaConteudo): number {
  switch (metrica) {
    case "leads":
      return c.atribuicao.leads;
    case "conversas":
      return c.atribuicao.conversas;
    case "oportunidades":
      return c.atribuicao.oportunidades;
    case "receita":
      return c.atribuicao.receitaCentavos;
    case "interacoes":
      return c.interacoes;
    case "alcance":
      return c.alcance;
  }
}

/**
 * Ordena por uma métrica de negócio. O desempate é sempre por interações — assim
 * dois conteúdos com zero lead não trocam de lugar a cada carregamento.
 */
export function ordenarConteudos<T extends ConteudoOrdenavel>(
  conteudos: T[],
  metrica: MetricaConteudo
): T[] {
  return [...conteudos].sort((a, b) => {
    const diff = valorDaMetrica(b, metrica) - valorDaMetrica(a, metrica);
    return diff !== 0 ? diff : b.interacoes - a.interacoes;
  });
}

// ─── Funil de aquisição ──────────────────────────────────────────────────────

export interface EtapaFunil {
  chave: string;
  label: string;
  /** null = não conseguimos medir esta etapa com os dados atuais. */
  valor: number | null;
  unidade: "numero" | "dinheiro";
  /** De onde o número saiu — aparece na tela para o número não virar fé. */
  fonte: string;
  /** Conversão a partir da etapa medível anterior. null quando não faz sentido. */
  taxa: number | null;
}

export interface DadosFunil {
  visualizacoes: number;
  interacoes: number;
  conversas: number;
  leads: number;
  oportunidades: number;
  clientes: number;
  /** null quando nenhuma receita pôde ser ligada a um conteúdo. */
  receitaCentavos: number | null;
}

/**
 * O funil da aquisição, do alcance à receita.
 *
 * A taxa de uma etapa é sempre relativa à etapa medível anterior e só aparece
 * quando as duas têm número e a anterior é maior que zero. Receita não tem taxa:
 * dinheiro dividido por gente não significa nada.
 */
export function montarFunil(d: DadosFunil): EtapaFunil[] {
  const etapas: EtapaFunil[] = [
    {
      chave: "visualizacoes",
      label: "Visualizações",
      valor: d.visualizacoes,
      unidade: "numero",
      fonte: "alcance dos conteúdos publicados",
      taxa: null,
    },
    {
      chave: "interacoes",
      label: "Interações",
      valor: d.interacoes,
      unidade: "numero",
      fonte: "curtidas, comentários, salvamentos e compartilhamentos",
      taxa: null,
    },
    {
      chave: "conversas",
      label: "Conversas",
      valor: d.conversas,
      unidade: "numero",
      fonte: "pessoas com quem a Máquina trocou direct",
      taxa: null,
    },
    {
      chave: "leads",
      label: "Leads",
      valor: d.leads,
      unidade: "numero",
      fonte: "leads de origem Instagram no pipeline",
      taxa: null,
    },
    {
      chave: "oportunidades",
      label: "Oportunidades",
      valor: d.oportunidades,
      unidade: "numero",
      fonte: "leads qualificados em diante",
      taxa: null,
    },
    {
      chave: "clientes",
      label: "Clientes",
      valor: d.clientes,
      unidade: "numero",
      fonte: "oportunidades já vinculadas a um cliente",
      taxa: null,
    },
    {
      chave: "receita",
      label: "Receita",
      valor: d.receitaCentavos,
      unidade: "dinheiro",
      fonte:
        d.receitaCentavos === null
          ? "atribuição desconhecida — nenhuma receita ligada a um conteúdo"
          : "receitas dos clientes que vieram desta cadeia",
      taxa: null,
    },
  ];

  let anterior: number | null = null;
  for (const etapa of etapas) {
    if (etapa.unidade === "numero" && etapa.valor !== null && anterior !== null && anterior > 0) {
      etapa.taxa = (etapa.valor / anterior) * 100;
    }
    if (etapa.valor !== null && etapa.unidade === "numero") anterior = etapa.valor;
  }

  return etapas;
}

/** Percentual simples, protegido contra divisão por zero. */
export function taxa(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return (parte / total) * 100;
}

export function fmtTaxa(valor: number | null): string {
  if (valor === null) return "—";
  if (valor > 0 && valor < 0.1) return "<0,1%";
  return `${valor.toFixed(1).replace(".", ",")}%`;
}

// ─── Atenção da Máquina ──────────────────────────────────────────────────────

/** Dias sem publicar que já contam como problema de operação. */
export const DIAS_SEM_PUBLICAR = 7;
/** Dias sem sincronizar conversas antes de avisar que o inbox está velho. */
export const DIAS_SYNC_CONVERSAS = 3;

export interface DadosAlertasMaquina {
  /** Conversas que dependem de resposta minha. */
  aguardandoResposta: number;
  /** Leads vindos do Instagram ainda no primeiro estágio. */
  leadsNaoTratados: { id: string; nome: string }[];
  /** Conteúdos com data no passado e status ainda AGENDADO. */
  agendadosVencidos: { id: string; titulo: string; dias: number }[];
  /** Dias desde a última publicação — null se nunca publicamos nada. */
  diasSemPublicar: number | null;
  /** Dias desde a última sincronização de conversas — null se nunca sincronizou. */
  diasSemSincronizar: number | null;
  /** A integração com o Instagram está configurada? */
  instagramConectado: boolean;
  /** Automações ativas que nunca dispararam. */
  automacoesSemExecucao: number;
  /**
   * Dias até o token do Instagram expirar. null quando não há data conhecida
   * (token antigo, só no .env) — nesse caso não dá para afirmar nada.
   */
  diasAteTokenExpirar?: number | null;
  /** A Graph API recusou o token (erro 190) — morto mesmo sem data de validade. */
  tokenRecusado?: boolean;
}

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

const PESO_SEVERIDADE: Record<Severidade, number> = {
  URGENTE: 2_000_000,
  ATENCAO: 1_000_000,
  INFO: 0,
};

/**
 * Problemas operacionais da Máquina, do mais grave ao menos. Mesma régua do
 * Negócio: só entra o que já está fora do lugar, nunca o que está em dia.
 */
export function montarAlertasMaquina(d: DadosAlertasMaquina): AlertaMaquina[] {
  const alertas: AlertaMaquina[] = [];

  if (!d.instagramConectado) {
    alertas.push({
      id: "integracao-instagram",
      titulo: "Instagram desconectado",
      detalhe: "sem token válido a Máquina para de receber conteúdo, conversas e automações",
      severidade: "URGENTE",
      destino: "/maquina/integracoes",
      destinoLabel: "Integrações",
      peso: 100,
    });
  }

  // O token dura 60 dias e já expirou em silêncio uma vez, derrubando as
  // respostas automáticas sem nenhum aviso. Agora ele cobra antes da hora.
  const diasToken = d.diasAteTokenExpirar;
  const recusado = d.tokenRecusado === true;
  if (d.instagramConectado && (recusado || (typeof diasToken === "number" && diasToken <= 7))) {
    const expirado = recusado || (typeof diasToken === "number" && diasToken <= 0);
    alertas.push({
      id: "token-instagram",
      titulo: expirado
        ? "Token do Instagram expirou"
        : `Token do Instagram expira em ${plural(diasToken as number, "dia", "dias")}`,
      detalhe: expirado
        ? "nenhuma automação consegue responder; reconecte a conta"
        : "reconecte antes de vencer para as automações não pararem",
      severidade: expirado ? "URGENTE" : "ATENCAO",
      destino: "/maquina/integracoes",
      destinoLabel: "Integrações",
      peso: expirado ? 99 : 20,
    });
  }

  for (const a of d.agendadosVencidos) {
    alertas.push({
      id: `agendado-${a.id}`,
      titulo: a.titulo,
      detalhe: `agendado há ${plural(a.dias, "dia", "dias")} e ainda não publicado`,
      severidade: "URGENTE",
      destino: "/maquina/calendario",
      destinoLabel: "Calendário",
      peso: a.dias,
    });
  }

  if (d.aguardandoResposta > 0) {
    alertas.push({
      id: "conversas-aguardando",
      titulo: `${plural(d.aguardandoResposta, "conversa", "conversas")} aguardando resposta`,
      detalhe: "cada hora parada esfria a conversa",
      severidade: "URGENTE",
      destino: "/maquina/conversas",
      destinoLabel: "Conversas",
      peso: d.aguardandoResposta,
    });
  }

  for (const l of d.leadsNaoTratados) {
    alertas.push({
      id: `lead-novo-${l.id}`,
      titulo: l.nome,
      detalhe: "lead gerado pela Máquina e ainda não trabalhado",
      severidade: "ATENCAO",
      destino: "/negocio/pipeline",
      destinoLabel: "Pipeline",
      peso: 10,
    });
  }

  if (d.diasSemPublicar !== null && d.diasSemPublicar >= DIAS_SEM_PUBLICAR) {
    alertas.push({
      id: "sem-publicar",
      titulo: `${plural(d.diasSemPublicar, "dia", "dias")} sem publicar`,
      detalhe: "sem conteúdo novo, o topo do funil seca",
      severidade: "ATENCAO",
      destino: "/maquina/conteudo",
      destinoLabel: "Conteúdo",
      peso: d.diasSemPublicar,
    });
  }

  if (d.diasSemSincronizar !== null && d.diasSemSincronizar >= DIAS_SYNC_CONVERSAS) {
    alertas.push({
      id: "sync-conversas",
      titulo: "Conversas desatualizadas",
      detalhe: `última sincronização há ${plural(d.diasSemSincronizar, "dia", "dias")}`,
      severidade: "INFO",
      destino: "/maquina/conversas",
      destinoLabel: "Conversas",
      peso: d.diasSemSincronizar,
    });
  }

  if (d.automacoesSemExecucao > 0) {
    alertas.push({
      id: "automacoes-paradas",
      titulo: `${plural(d.automacoesSemExecucao, "automação ativa", "automações ativas")} sem nenhuma execução`,
      detalhe: "palavra-chave que ninguém usa ou post sem alcance",
      severidade: "INFO",
      destino: "/maquina/automacoes",
      destinoLabel: "Automações",
      peso: d.automacoesSemExecucao,
    });
  }

  return alertas.sort(
    (a, b) =>
      PESO_SEVERIDADE[b.severidade] + b.peso - (PESO_SEVERIDADE[a.severidade] + a.peso)
  );
}

/** Dias inteiros entre duas datas, em UTC. Negativo quando a data é futura. */
export function diasDesde(data: Date | string, agora = new Date()): number {
  const d = new Date(data);
  const inicio = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  return Math.round((hoje - inicio) / 86_400_000);
}
