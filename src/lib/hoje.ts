// Camada de priorização da tela Hoje — funções puras, sem dependências de framework.
//
// Hoje NÃO tem engine própria de alertas. Ela consome o que montarAlertas
// (negócio) e montarAlertasMaquina (máquina) já produzem, e só decide o que vem
// primeiro, o que é de hoje e o que fica para depois.

import { diasParaVencer } from "@/lib/compromisso";
import type { AlertaNegocio, Severidade } from "@/lib/negocio-overview";

// ─── Saudação ────────────────────────────────────────────────────────────────

/** Bom dia / Boa tarde / Boa noite pela hora local de quem está olhando. */
export function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// ─── De onde veio o sinal ────────────────────────────────────────────────────

export type FonteAtencao =
  | "FINANCEIRO"
  | "PIPELINE"
  | "CLIENTE"
  | "MAQUINA"
  | "TAREFA"
  | "COMPROMISSO";

/**
 * A fonte sai da rota de destino que a engine já preenche — nenhuma classificação
 * nova é inventada aqui, e nenhum campo precisou ser acrescentado ao AlertaNegocio.
 */
const FONTE_POR_DESTINO: { prefixo: string; fonte: FonteAtencao; acao: string }[] = [
  { prefixo: "/negocio/financeiro", fonte: "FINANCEIRO", acao: "Cobrar" },
  { prefixo: "/negocio/pipeline", fonte: "PIPELINE", acao: "Follow-up" },
  { prefixo: "/negocio/saude", fonte: "CLIENTE", acao: "Registrar contato" },
  { prefixo: "/negocio/clientes", fonte: "CLIENTE", acao: "Abrir cliente" },
  { prefixo: "/negocio/compromissos", fonte: "COMPROMISSO", acao: "Cumprir" },
  { prefixo: "/negocio/tarefas", fonte: "TAREFA", acao: "Concluir" },
  { prefixo: "/maquina/engine", fonte: "MAQUINA", acao: "Aprovar" },
  { prefixo: "/maquina/conversas", fonte: "MAQUINA", acao: "Responder" },
  { prefixo: "/maquina/conteudo", fonte: "MAQUINA", acao: "Ver conteúdo" },
  { prefixo: "/maquina/automacoes", fonte: "MAQUINA", acao: "Ver problema" },
  { prefixo: "/maquina", fonte: "MAQUINA", acao: "Abrir" },
];

export function fonteDoAlerta(destino: string): FonteAtencao {
  return FONTE_POR_DESTINO.find((f) => destino.startsWith(f.prefixo))?.fonte ?? "TAREFA";
}

export function acaoDoAlerta(destino: string): string {
  return FONTE_POR_DESTINO.find((f) => destino.startsWith(f.prefixo))?.acao ?? "Abrir";
}

export const LABEL_FONTE: Record<FonteAtencao, string> = {
  FINANCEIRO: "Financeiro",
  PIPELINE: "Pipeline",
  CLIENTE: "Cliente",
  MAQUINA: "Máquina",
  TAREFA: "Tarefa",
  COMPROMISSO: "Compromisso",
};

// ─── Item priorizado ─────────────────────────────────────────────────────────

export interface ItemAtencao {
  id: string;
  titulo: string;
  detalhe: string;
  severidade: Severidade;
  fonte: FonteAtencao;
  /** Verbo da ação, derivado do destino: "Cobrar", "Follow-up", "Responder"… */
  acaoLabel: string;
  destino: string;
  /** Posição final na lista. Menor vem primeiro. Só para depuração e testes. */
  ordem: number;
}

/**
 * Régua de prioridade, em um lugar só.
 *
 * Primeiro a gravidade que a engine já atribuiu; dentro do mesmo nível, a fonte,
 * na ordem em que o dia costuma doer: dinheiro, promessa a terceiro, cliente em
 * risco, quem está esperando resposta, avanço comercial e, por fim, tarefa
 * interna. O desempate final é o peso da engine (normalmente dias de atraso).
 */
const NIVEL_SEVERIDADE: Record<Severidade, number> = {
  URGENTE: 0,
  ATENCAO: 1,
  INFO: 2,
};

const ORDEM_FONTE: Record<FonteAtencao, number> = {
  FINANCEIRO: 0,
  COMPROMISSO: 1,
  CLIENTE: 2,
  MAQUINA: 3,
  PIPELINE: 4,
  TAREFA: 5,
};

/** Espaço reservado a cada nível, para a fonte nunca ultrapassar a gravidade. */
const FAIXA_NIVEL = 1_000_000;
const FAIXA_FONTE = 100_000;

export function priorizarAtencao(alertas: AlertaNegocio[]): ItemAtencao[] {
  return alertas
    .map((a) => {
      const fonte = fonteDoAlerta(a.destino);
      // Peso limitado para um atraso absurdo não furar a faixa da fonte.
      const pesoLimitado = Math.min(Math.max(a.peso, 0), FAIXA_FONTE - 1);
      return {
        id: a.id,
        titulo: a.titulo,
        detalhe: a.detalhe,
        severidade: a.severidade,
        fonte,
        acaoLabel: acaoDoAlerta(a.destino),
        destino: a.destino,
        ordem:
          NIVEL_SEVERIDADE[a.severidade] * FAIXA_NIVEL +
          ORDEM_FONTE[fonte] * FAIXA_FONTE +
          (FAIXA_FONTE - 1 - pesoLimitado),
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

// ─── Agenda de hoje ──────────────────────────────────────────────────────────

export interface CompromissoHoje {
  id: string;
  descricao: string;
  para: string;
  prazoEm: string | Date;
  cumprido: boolean;
}

export interface TarefaHoje {
  id: string;
  title: string;
  dueDate: string | Date | null;
  done: boolean;
  priority: string;
  clienteNome?: string | null;
}

export interface ItemAgenda {
  id: string;
  titulo: string;
  detalhe: string;
  /** "14:00" quando há hora definida; null quando é só uma data. */
  hora: string | null;
  destino: string;
}

function horaLocal(data: string | Date): string | null {
  const d = new Date(data);
  // Meia-noite exata é "sem hora marcada", não um compromisso à 00:00.
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Compromissos de hoje que ainda vão acontecer. O que já venceu não entra aqui —
 * vive em "Sua atenção", onde a engine já o colocou como urgente.
 */
export function agendaDeHoje(compromissos: CompromissoHoje[]): ItemAgenda[] {
  return compromissos
    .filter((c) => !c.cumprido && diasParaVencer(c.prazoEm) === 0)
    .map((c) => ({
      id: `compromisso-${c.id}`,
      titulo: c.descricao,
      detalhe: c.para,
      hora: horaLocal(c.prazoEm),
      destino: "/negocio/compromissos",
    }))
    .sort((a, b) => (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"));
}

// ─── Tarefas de hoje ─────────────────────────────────────────────────────────

const ORDEM_PRIORIDADE: Record<string, number> = { high: 0, medium: 1, low: 2 };

export interface TarefaDoDia extends TarefaHoje {
  /** Negativo = atrasada. 0 = vence hoje. */
  diasAteVencer: number;
  atrasada: boolean;
}

/**
 * Só o que é do dia: vencidas e vencendo hoje. A lista global de tarefas continua
 * na tela de Tarefas — Hoje não despeja tudo.
 */
export function tarefasDeHoje(tarefas: TarefaHoje[]): TarefaDoDia[] {
  return tarefas
    .filter((t) => !t.done && t.dueDate)
    .map((t) => {
      const dias = diasParaVencer(t.dueDate as string | Date);
      return { ...t, diasAteVencer: dias, atrasada: dias < 0 };
    })
    .filter((t) => t.diasAteVencer <= 0)
    .sort(
      (a, b) =>
        a.diasAteVencer - b.diasAteVencer ||
        (ORDEM_PRIORIDADE[a.priority] ?? 1) - (ORDEM_PRIORIDADE[b.priority] ?? 1) ||
        a.title.localeCompare(b.title, "pt-BR")
    );
}

// ─── Próximos dias ───────────────────────────────────────────────────────────

export interface ItemProximo {
  id: string;
  titulo: string;
  detalhe: string;
  emDias: number;
  destino: string;
}

/** Janela de "Próximos": o suficiente para se preparar, sem virar calendário. */
export const DIAS_PROXIMOS = 7;

export function proximosDias(
  compromissos: CompromissoHoje[],
  tarefas: TarefaHoje[],
  limite = 5
): ItemProximo[] {
  const itens: ItemProximo[] = [];

  for (const c of compromissos) {
    if (c.cumprido) continue;
    const dias = diasParaVencer(c.prazoEm);
    if (dias <= 0 || dias > DIAS_PROXIMOS) continue;
    itens.push({
      id: `compromisso-${c.id}`,
      titulo: c.descricao,
      detalhe: `Compromisso · ${c.para}`,
      emDias: dias,
      destino: "/negocio/compromissos",
    });
  }

  for (const t of tarefas) {
    if (t.done || !t.dueDate) continue;
    const dias = diasParaVencer(t.dueDate);
    if (dias <= 0 || dias > DIAS_PROXIMOS) continue;
    itens.push({
      id: `tarefa-${t.id}`,
      titulo: t.title,
      detalhe: "Tarefa",
      emDias: dias,
      destino: "/negocio/tarefas",
    });
  }

  return itens.sort((a, b) => a.emDias - b.emDias || a.titulo.localeCompare(b.titulo, "pt-BR")).slice(0, limite);
}

// ─── Resumo do dia ───────────────────────────────────────────────────────────

export interface ContagemDoDia {
  urgentes: number;
  atencao: number;
  compromissosHoje: number;
  tarefasHoje: number;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * A frase abaixo da saudação, derivada dos números reais — nunca uma mensagem
 * motivacional genérica.
 */
export function resumoDoDia(c: ContagemDoDia): string {
  const planejados = c.compromissosHoje + c.tarefasHoje;

  if (c.urgentes > 0) {
    const base = `${plural(c.urgentes, "item urgente", "itens urgentes")}`;
    if (c.atencao > 0) return `${base} e ${plural(c.atencao, "ação", "ações")} pedindo atenção.`;
    return `${base} para resolver agora.`;
  }

  if (c.atencao > 0) {
    return `${plural(c.atencao, "item precisa", "itens precisam")} da sua atenção hoje.`;
  }

  if (planejados > 0) {
    return `Tudo sob controle. Você tem ${plural(planejados, "item planejado", "itens planejados")} para hoje.`;
  }

  return "Tudo sob controle. Nada exige sua atenção agora.";
}

// ─── Briefing estruturado (preparo para IA) ──────────────────────────────────

/**
 * O mesmo conteúdo da tela, em formato de dados.
 *
 * Não gera texto com LLM — só entrega a fonte confiável que um briefing futuro
 * consumiria, e que já responde "o que está atrasado?", "quem espera resposta?"
 * e "tem dinheiro em risco?" sem consultar mais nada.
 */
export interface BriefingDoDia {
  geradoEm: string;
  resumo: string;
  contagem: ContagemDoDia;
  prioridades: ItemAtencao[];
  agenda: ItemAgenda[];
  tarefas: TarefaDoDia[];
  proximos: ItemProximo[];
  /** Atalhos das perguntas que a tela deve saber responder. */
  porFonte: Record<FonteAtencao, number>;
}

export function montarBriefing(dados: {
  agora: Date;
  atencao: ItemAtencao[];
  agenda: ItemAgenda[];
  tarefas: TarefaDoDia[];
  proximos: ItemProximo[];
}): BriefingDoDia {
  const contagem: ContagemDoDia = {
    urgentes: dados.atencao.filter((a) => a.severidade === "URGENTE").length,
    atencao: dados.atencao.filter((a) => a.severidade === "ATENCAO").length,
    compromissosHoje: dados.agenda.length,
    tarefasHoje: dados.tarefas.length,
  };

  const porFonte = Object.keys(LABEL_FONTE).reduce(
    (acc, f) => ({ ...acc, [f]: dados.atencao.filter((a) => a.fonte === f).length }),
    {} as Record<FonteAtencao, number>
  );

  return {
    geradoEm: dados.agora.toISOString(),
    resumo: resumoDoDia(contagem),
    contagem,
    prioridades: dados.atencao,
    agenda: dados.agenda,
    tarefas: dados.tarefas,
    proximos: dados.proximos,
    porFonte,
  };
}
