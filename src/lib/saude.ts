// Engine de saúde da carteira — funções puras, sem dependências de framework.
//
// Saúde não é um campo manual: é derivada dos sinais que já existem no sistema
// (interações, receitas, tarefas, compromissos e oportunidades). Esta é a ÚNICA
// fonte de verdade da saúde do cliente — a tela de Saúde, a lista de Clientes, o
// Cliente 360° e o painel de /negocio consomem daqui, sem recalcular nada.
//
// O que NÃO nasce aqui: dinheiro é decidido em financeiro.ts (o que está vencido
// e há quantos dias), prazo em compromisso.ts, estagnação comercial em pipeline.ts.
// Esta engine só lê esses sinais, pesa e classifica.
//
// Nada de número mágico espalhado pelos componentes: pesos e limiares moram em
// CONFIG_SAUDE.

import { diasParaVencer } from "@/lib/compromisso";
import {
  calcMRR,
  contaComoReceita,
  contaParaMRR,
  diasEmAtraso,
  isVencida,
  type ReceitaLike,
} from "@/lib/financeiro";
import { DIAS_PARADO_ATENCAO, DIAS_PARADO_RISCO, ESTAGIOS_ATIVOS, labelEstagio } from "@/lib/pipeline";

/**
 * SEM_DADOS não é nota boa nem ruim: é a ausência de base para diagnosticar.
 * Cliente recém-cadastrado começa aqui, e não em VERDE — silêncio de quem acabou
 * de entrar não é saúde comprovada, e também não é risco.
 */
export type StatusSaude = "VERMELHO" | "AMARELO" | "VERDE" | "SEM_DADOS";

/** Ordem de urgência — é esta a ordem em que a carteira é lida. */
export const STATUS_SAUDE: StatusSaude[] = ["VERMELHO", "AMARELO", "SEM_DADOS", "VERDE"];

// ─── Configuração ────────────────────────────────────────────────────────────

/**
 * Toda régua da saúde num lugar só.
 *
 * Os pesos são calibrados contra os limiares de score: um sinal de peso 25 sozinho
 * derruba para Atenção (100 − 25 = 75); um de peso 55 sozinho derruba para Em risco
 * (100 − 55 = 45). Mexer aqui muda o diagnóstico do sistema inteiro.
 */
export const CONFIG_SAUDE = {
  SCORE_MAXIMO: 100,
  /** score >= LIMIAR_VERDE → Saudável. */
  LIMIAR_VERDE: 80,
  /** score >= LIMIAR_AMARELO (e < LIMIAR_VERDE) → Atenção. Abaixo, Em risco. */
  LIMIAR_AMARELO: 50,

  /** Cadastrado há menos que isso e sem nenhum histórico: SEM_DADOS, não risco. */
  JANELA_CLIENTE_NOVO_DIAS: 14,

  /** Fora do radar: sem diagnóstico e fora das contagens. */
  STATUS_FORA_DO_RADAR: ["lost"] as string[],
  /**
   * Relação dormente por decisão, não por descuido: a falta de contato não pesa.
   * Os sinais financeiros continuam valendo.
   */
  STATUS_SEM_COBRANCA_DE_CONTATO: ["inactive"] as string[],

  /** Dias desde o último contato registrado → peso. Vale a maior faixa atingida. */
  FAIXAS_SEM_CONTATO: [
    { dias: 7, peso: 25 },
    { dias: 21, peso: 45 },
    { dias: 45, peso: 60 },
  ],
  /**
   * Cliente que nunca teve contato registrado, medido desde o cadastro. Pesa menos
   * que um contato que existiu e esfriou: ausência de registro é evidência mais
   * fraca do que uma relação comprovadamente parada.
   */
  FAIXAS_SEM_HISTORICO: [
    { dias: 14, peso: 25 },
    { dias: 45, peso: 40 },
  ],

  /** Dias de atraso do pagamento → peso. Quem decide o atraso é financeiro.ts. */
  FAIXAS_PAGAMENTO_VENCIDO: [
    { dias: 1, peso: 30 },
    { dias: 15, peso: 55 },
  ],
  PESO_RECORRENCIA_INTERROMPIDA: 35,

  PESO_COMPROMISSO_VENCIDO: 40,
  PESO_COMPROMISSO_MUITO_ATRASADO: 55,
  DIAS_COMPROMISSO_MUITO_ATRASADO: 7,

  PESO_TAREFA_ATRASADA: 15,
  PESO_TAREFA_ATRASADA_EXTRA: 10,
  PESO_TAREFA_ATRASADA_MAXIMO: 35,

  PESO_OPORTUNIDADE_PARADA: 20,
  PESO_OPORTUNIDADE_MUITO_PARADA: 30,
  PESO_ACAO_COMERCIAL_ATRASADA: 25,
} as const;

// ─── Sinais ──────────────────────────────────────────────────────────────────

export type CategoriaSinal = "RELACIONAMENTO" | "FINANCEIRO" | "COMERCIAL" | "OPERACAO";

export type ChaveSinal =
  | "SEM_CONTATO"
  | "SEM_HISTORICO_CONTATO"
  | "PAGAMENTO_VENCIDO"
  | "RECORRENCIA_INTERROMPIDA"
  | "COMPROMISSO_VENCIDO"
  | "TAREFAS_ATRASADAS"
  | "OPORTUNIDADE_PARADA"
  | "ACAO_COMERCIAL_ATRASADA";

export interface SinalSaude {
  chave: ChaveSinal;
  categoria: CategoriaSinal;
  /** Frase pronta para o usuário: "Sem contato há 12 dias". */
  texto: string;
  peso: number;
  /**
   * True quando o mesmo fato já vira alerta próprio no painel (tarefa vencida,
   * receita atrasada, compromisso, oportunidade parada). Evita dizer a mesma coisa
   * duas vezes em "Precisa da sua atenção": lá, do diagnóstico só entra o que
   * nenhuma outra régua conta.
   */
  temAlertaProprio: boolean;
}

// ─── Ação recomendada ────────────────────────────────────────────────────────

export type ChaveAcao =
  | "REGISTRAR_CONTATO"
  | "COBRAR_PAGAMENTO"
  | "REVISAR_RECORRENCIA"
  | "CUMPRIR_COMPROMISSO"
  | "RESOLVER_TAREFA"
  | "FAZER_FOLLOW_UP";

export interface AcaoRecomendada {
  chave: ChaveAcao;
  label: string;
  /** Tela dona da ação. Null = a ação acontece na própria tela de Saúde. */
  destino: string | null;
}

/** De qual sinal nasce qual ação. Determinístico — nenhuma IA envolvida. */
const ACAO_POR_SINAL: Record<ChaveSinal, AcaoRecomendada> = {
  PAGAMENTO_VENCIDO: { chave: "COBRAR_PAGAMENTO", label: "Cobrar pagamento", destino: "/negocio/financeiro" },
  RECORRENCIA_INTERROMPIDA: { chave: "REVISAR_RECORRENCIA", label: "Revisar recorrência", destino: "/negocio/financeiro" },
  COMPROMISSO_VENCIDO: { chave: "CUMPRIR_COMPROMISSO", label: "Cumprir compromisso", destino: "/negocio/compromissos" },
  TAREFAS_ATRASADAS: { chave: "RESOLVER_TAREFA", label: "Resolver tarefa", destino: "/negocio/tarefas" },
  OPORTUNIDADE_PARADA: { chave: "FAZER_FOLLOW_UP", label: "Fazer follow-up", destino: "/negocio/pipeline" },
  ACAO_COMERCIAL_ATRASADA: { chave: "FAZER_FOLLOW_UP", label: "Fazer follow-up", destino: "/negocio/pipeline" },
  SEM_CONTATO: { chave: "REGISTRAR_CONTATO", label: "Registrar contato", destino: null },
  SEM_HISTORICO_CONTATO: { chave: "REGISTRAR_CONTATO", label: "Registrar contato", destino: null },
};

// ─── Entrada ─────────────────────────────────────────────────────────────────

/** Uma receita, na visão da saúde. As regras de vencimento vivem em financeiro.ts. */
export type ReceitaSaude = ReceitaLike;

export interface InteracaoSaude {
  tipo: string;
  ocorreuEm: string | Date;
}

export interface TarefaSaude {
  done: boolean;
  dueDate: string | Date | null;
}

export interface CompromissoSaude {
  cumprido: boolean;
  prazoEm: string | Date;
}

export interface OportunidadeSaude {
  estagio: string;
  proximaAcao: string | null;
  proximaAcaoEm: string | Date | null;
  estagioDesde?: string | Date | null;
  atualizadoEm: string | Date;
}

/** Tudo que a engine precisa saber sobre um cliente para diagnosticá-lo. */
export interface ContextoSaude {
  status: string; // lead | active | inactive | lost
  criadoEm: string | Date;
  arquivadoEm?: string | Date | null;
  /** Campo manual, anterior às interações. Continua contando como contato. */
  ultimoContatoEm: string | Date | null;
  interacoes: InteracaoSaude[];
  receitas: ReceitaSaude[];
  tarefas: TarefaSaude[];
  compromissos: CompromissoSaude[];
  oportunidades: OportunidadeSaude[];
  agora?: Date;
}

// ─── Saída ───────────────────────────────────────────────────────────────────

/**
 * O diagnóstico completo de um cliente.
 *
 * O formato é deliberadamente autoexplicativo: um dia isto vira o contexto de uma
 * pergunta a um modelo ("por que este cliente está em risco?", "o que faço hoje
 * para melhorar a carteira?") sem precisar de tradução nenhuma. Hoje não há IA
 * envolvida — tudo aqui é determinístico.
 */
export interface DiagnosticoSaude {
  status: StatusSaude;
  /** 0–100. Existe para dar consistência à faixa, não para ser exibido grande. */
  score: number;
  /** Por que o cliente recebeu esta classificação, do mais grave ao menos. */
  motivos: SinalSaude[];
  /** O que está indo bem. Nunca inventado: só o que os dados sustentam. */
  sinaisPositivos: string[];
  acaoRecomendada: AcaoRecomendada | null;
  /** Uma linha que explica o diagnóstico. Sempre presente, inclusive em SEM_DADOS. */
  resumo: string;

  // Contexto cru — alimenta a interface hoje e as perguntas de amanhã.
  ultimaInteracaoEm: string | null;
  diasSemContato: number | null;
  diasDesdeCadastro: number;
  clienteNovo: boolean;
  mrrCentavos: number;
  tarefasAbertas: number;
  tarefasAtrasadas: number;
  compromissosVencidos: number;
  receitasVencidas: number;
  valorVencidoCentavos: number;
  diasAtrasoPagamento: number;
  oportunidadesAbertas: number;
  oportunidadesParadas: number;
}

// ─── Apresentação ────────────────────────────────────────────────────────────

const LABEL: Record<StatusSaude, string> = {
  VERDE: "Saudável",
  AMARELO: "Atenção",
  VERMELHO: "Em risco",
  SEM_DADOS: "Sem dados",
};

const COR: Record<StatusSaude, string> = {
  VERDE: "#22C55E",
  AMARELO: "#F59E0B",
  VERMELHO: "#EF4444",
  SEM_DADOS: "#6b81a8",
};

/** Tom semântico do painel — mesma escala do Dot em components/negocio/panel. */
const TOM: Record<StatusSaude, "URGENTE" | "ATENCAO" | "OK" | "NEUTRO"> = {
  VERMELHO: "URGENTE",
  AMARELO: "ATENCAO",
  VERDE: "OK",
  SEM_DADOS: "NEUTRO",
};

export function labelSaude(status: StatusSaude): string {
  return LABEL[status] ?? status;
}

export function corSaude(status: StatusSaude): string {
  return COR[status] ?? COR.SEM_DADOS;
}

export function tomSaude(status: StatusSaude): "URGENTE" | "ATENCAO" | "OK" | "NEUTRO" {
  return TOM[status] ?? "NEUTRO";
}

/** Posição na ordem de urgência: 0 = mais urgente. */
export function ordemSaude(status: StatusSaude): number {
  const i = STATUS_SAUDE.indexOf(status);
  return i === -1 ? STATUS_SAUDE.length : i;
}

// ─── Contato ─────────────────────────────────────────────────────────────────

/**
 * Tipos de interação que contam como contato de verdade.
 *
 * Observação interna (NOTA) e eventos gravados pelo sistema (STATUS, SAUDE) não
 * são conversa com o cliente: tratá-los como contato mascararia o silêncio, que é
 * justamente o sinal que a tela de Saúde existe para enxergar.
 */
export const TIPOS_CONTATO = ["LIGACAO", "WHATSAPP", "EMAIL", "REUNIAO", "OUTRO"] as const;

export function isContato(tipo: string): boolean {
  return (TIPOS_CONTATO as readonly string[]).includes(tipo);
}

/** Instante do contato mais recente: o campo manual ou a última interação de contato. */
export function ultimoContatoEmMs(
  ultimoContatoEm: string | Date | null,
  interacoes: InteracaoSaude[]
): number | null {
  const datas: number[] = [];
  if (ultimoContatoEm) datas.push(new Date(ultimoContatoEm).getTime());
  for (const i of interacoes) {
    if (isContato(i.tipo)) datas.push(new Date(i.ocorreuEm).getTime());
  }
  if (datas.length === 0) return null;
  return Math.max(...datas);
}

// ─── Utilidades internas ─────────────────────────────────────────────────────

function diasDesde(data: string | Date, agora: Date): number {
  return Math.floor((agora.getTime() - new Date(data).getTime()) / 86_400_000);
}

function inicioDoMes(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

function haDias(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

/** Maior faixa atingida, ou null se ainda não chegou na primeira. */
function faixaAtingida(
  dias: number,
  faixas: readonly { dias: number; peso: number }[]
): { dias: number; peso: number } | null {
  let escolhida: { dias: number; peso: number } | null = null;
  for (const faixa of faixas) {
    if (dias >= faixa.dias) escolhida = faixa;
  }
  return escolhida;
}

/** Valor curto, sem centavos — a frase do motivo não é extrato bancário. */
function reais(centavos: number): string {
  return `R$ ${Math.round(centavos / 100).toLocaleString("pt-BR")}`;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Diagnostica um cliente a partir dos sinais reais do sistema.
 *
 * Começa em 100 e desconta o peso de cada sinal encontrado; o score resultante cai
 * numa das três faixas. Antes disso, dois portões: cliente fora do radar (perdido
 * ou arquivado) não é diagnosticado, e cliente novo sem nenhum histórico é
 * SEM_DADOS — não punimos quem acabou de entrar, e também não fingimos que a
 * ausência de informação é saúde perfeita.
 */
export function calcularSaudeCliente(ctx: ContextoSaude): DiagnosticoSaude {
  const agora = ctx.agora ?? new Date();
  const diasDesdeCadastro = Math.max(diasDesde(ctx.criadoEm, agora), 0);
  const clienteNovo = diasDesdeCadastro < CONFIG_SAUDE.JANELA_CLIENTE_NOVO_DIAS;

  const contatoMs = ultimoContatoEmMs(ctx.ultimoContatoEm, ctx.interacoes);
  const ultimaInteracaoEm = contatoMs === null ? null : new Date(contatoMs).toISOString();
  const diasSemContato =
    contatoMs === null ? null : Math.max(diasDesde(new Date(contatoMs), agora), 0);

  // Dinheiro: quem decide o que está vencido, e há quantos dias, é financeiro.ts.
  const receitasValidas = ctx.receitas.filter(contaComoReceita);
  const inicioMes = inicioDoMes(agora);
  const fimMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
  const inicioMesAnterior = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));

  const noPeriodo = (r: ReceitaSaude, de: Date, ate: Date) => {
    if (!r.competencia) return false;
    const c = new Date(r.competencia);
    return c >= de && c < ate;
  };

  const receitasDoMes = receitasValidas.filter((r) => noPeriodo(r, inicioMes, fimMes));
  const mrrCentavos = calcMRR(receitasDoMes, agora);

  const vencidas = receitasValidas.filter((r) => isVencida(r, agora));
  const valorVencidoCentavos = vencidas.reduce((s, r) => s + r.valorCentavos, 0);
  const diasAtrasoPagamento = vencidas.reduce((max, r) => Math.max(max, diasEmAtraso(r, agora)), 0);

  const tarefasAbertas = ctx.tarefas.filter((t) => !t.done).length;
  const tarefasAtrasadas = ctx.tarefas.filter(
    (t) => !t.done && t.dueDate && diasParaVencer(t.dueDate) < 0
  );
  const compromissosVencidos = ctx.compromissos.filter(
    (c) => !c.cumprido && diasParaVencer(c.prazoEm) < 0
  );
  const oportunidadesAtivas = ctx.oportunidades.filter((o) => ESTAGIOS_ATIVOS.includes(o.estagio));

  const contexto = {
    ultimaInteracaoEm,
    diasSemContato,
    diasDesdeCadastro,
    clienteNovo,
    mrrCentavos,
    tarefasAbertas,
    tarefasAtrasadas: tarefasAtrasadas.length,
    compromissosVencidos: compromissosVencidos.length,
    receitasVencidas: vencidas.length,
    valorVencidoCentavos,
    diasAtrasoPagamento,
    oportunidadesAbertas: oportunidadesAtivas.length,
    oportunidadesParadas: 0,
  };

  // ── Portão 1: fora do radar ──────────────────────────────────────────────
  const arquivado = Boolean(ctx.arquivadoEm);
  if (arquivado || CONFIG_SAUDE.STATUS_FORA_DO_RADAR.includes(ctx.status)) {
    return {
      ...contexto,
      status: "SEM_DADOS",
      score: CONFIG_SAUDE.SCORE_MAXIMO,
      motivos: [],
      sinaisPositivos: [],
      acaoRecomendada: null,
      resumo: arquivado ? "Cliente arquivado — fora do radar" : "Cliente perdido — fora do radar",
    };
  }

  // ── Sinais ───────────────────────────────────────────────────────────────
  const motivos: SinalSaude[] = [];
  const cobraContato = !CONFIG_SAUDE.STATUS_SEM_COBRANCA_DE_CONTATO.includes(ctx.status);

  // Relacionamento
  if (cobraContato && diasSemContato !== null) {
    const faixa = faixaAtingida(diasSemContato, CONFIG_SAUDE.FAIXAS_SEM_CONTATO);
    if (faixa) {
      motivos.push({
        chave: "SEM_CONTATO",
        categoria: "RELACIONAMENTO",
        texto: `Sem contato ${haDias(diasSemContato)}`,
        peso: faixa.peso,
        temAlertaProprio: false,
      });
    }
  } else if (cobraContato) {
    const faixa = faixaAtingida(diasDesdeCadastro, CONFIG_SAUDE.FAIXAS_SEM_HISTORICO);
    if (faixa) {
      motivos.push({
        chave: "SEM_HISTORICO_CONTATO",
        categoria: "RELACIONAMENTO",
        texto: `Nenhum contato registrado desde o cadastro (${haDias(diasDesdeCadastro)})`,
        peso: faixa.peso,
        temAlertaProprio: false,
      });
    }
  }

  // Financeiro
  const faixaPagamento = faixaAtingida(diasAtrasoPagamento, CONFIG_SAUDE.FAIXAS_PAGAMENTO_VENCIDO);
  if (faixaPagamento) {
    motivos.push({
      chave: "PAGAMENTO_VENCIDO",
      categoria: "FINANCEIRO",
      texto:
        vencidas.length === 1
          ? `Pagamento vencido ${haDias(diasAtrasoPagamento)} · ${reais(valorVencidoCentavos)}`
          : `${vencidas.length} pagamentos vencidos (o mais antigo ${haDias(diasAtrasoPagamento)}) · ${reais(valorVencidoCentavos)}`,
      peso: faixaPagamento.peso,
      temAlertaProprio: true,
    });
  }

  // Recorrência interrompida: faturava mês passado, nada lançado neste mês.
  const recorrenteMesAnterior = receitasValidas.some(
    (r) => noPeriodo(r, inicioMesAnterior, inicioMes) && contaParaMRR(r, agora)
  );
  const recorrenteEsteMes = receitasDoMes.some((r) => r.tipo === "RECORRENTE");
  if (recorrenteMesAnterior && !recorrenteEsteMes) {
    motivos.push({
      chave: "RECORRENCIA_INTERROMPIDA",
      categoria: "FINANCEIRO",
      texto: "Recorrência sem receita lançada neste mês",
      peso: CONFIG_SAUDE.PESO_RECORRENCIA_INTERROMPIDA,
      temAlertaProprio: false,
    });
  }

  // Operação
  if (compromissosVencidos.length > 0) {
    const atraso = Math.max(...compromissosVencidos.map((c) => -diasParaVencer(c.prazoEm)));
    motivos.push({
      chave: "COMPROMISSO_VENCIDO",
      categoria: "OPERACAO",
      texto:
        compromissosVencidos.length === 1
          ? `Compromisso vencido ${haDias(atraso)}`
          : `${compromissosVencidos.length} compromissos vencidos (o mais antigo ${haDias(atraso)})`,
      peso:
        atraso >= CONFIG_SAUDE.DIAS_COMPROMISSO_MUITO_ATRASADO
          ? CONFIG_SAUDE.PESO_COMPROMISSO_MUITO_ATRASADO
          : CONFIG_SAUDE.PESO_COMPROMISSO_VENCIDO,
      temAlertaProprio: true,
    });
  }

  if (tarefasAtrasadas.length > 0) {
    const n = tarefasAtrasadas.length;
    motivos.push({
      chave: "TAREFAS_ATRASADAS",
      categoria: "OPERACAO",
      texto: plural(n, "tarefa atrasada", "tarefas atrasadas"),
      peso: Math.min(
        CONFIG_SAUDE.PESO_TAREFA_ATRASADA + (n - 1) * CONFIG_SAUDE.PESO_TAREFA_ATRASADA_EXTRA,
        CONFIG_SAUDE.PESO_TAREFA_ATRASADA_MAXIMO
      ),
      temAlertaProprio: true,
    });
  }

  // Comercial. Uma oportunidade com próxima ação marcada para o futuro tem plano:
  // não está parada. Se a ação venceu, o sinal é o atraso da ação — não contamos
  // duas vezes o mesmo fato. Só sem data nenhuma é que o tempo no estágio manda.
  let acaoAtrasadaDias = 0;
  let paradaMaxima = 0;
  let estagioParado = "";
  let paradas = 0;
  for (const o of oportunidadesAtivas) {
    if (o.proximaAcaoEm) {
      const dias = diasParaVencer(o.proximaAcaoEm);
      if (dias < 0) acaoAtrasadaDias = Math.max(acaoAtrasadaDias, -dias);
      continue;
    }
    const parada = diasDesde(o.estagioDesde ?? o.atualizadoEm, agora);
    if (parada < DIAS_PARADO_ATENCAO) continue;
    paradas += 1;
    if (parada > paradaMaxima) {
      paradaMaxima = parada;
      estagioParado = o.estagio;
    }
  }
  contexto.oportunidadesParadas = paradas;

  if (acaoAtrasadaDias > 0) {
    motivos.push({
      chave: "ACAO_COMERCIAL_ATRASADA",
      categoria: "COMERCIAL",
      texto: `Próxima ação da oportunidade atrasada ${haDias(acaoAtrasadaDias)}`,
      peso: CONFIG_SAUDE.PESO_ACAO_COMERCIAL_ATRASADA,
      temAlertaProprio: true,
    });
  }
  if (paradaMaxima > 0) {
    motivos.push({
      chave: "OPORTUNIDADE_PARADA",
      categoria: "COMERCIAL",
      texto: `Oportunidade parada em ${labelEstagio(estagioParado)} ${haDias(paradaMaxima)}`,
      peso:
        paradaMaxima >= DIAS_PARADO_RISCO
          ? CONFIG_SAUDE.PESO_OPORTUNIDADE_MUITO_PARADA
          : CONFIG_SAUDE.PESO_OPORTUNIDADE_PARADA,
      temAlertaProprio: true,
    });
  }

  motivos.sort((a, b) => b.peso - a.peso);

  // ── Sinais positivos ─────────────────────────────────────────────────────
  const sinaisPositivos: string[] = [];
  if (diasSemContato !== null && diasSemContato < CONFIG_SAUDE.FAIXAS_SEM_CONTATO[0].dias) {
    sinaisPositivos.push(`Último contato ${haDias(diasSemContato)}`);
  }
  if (receitasValidas.length > 0 && vencidas.length === 0) {
    sinaisPositivos.push("Pagamentos em dia");
  }
  if (mrrCentavos > 0) {
    sinaisPositivos.push(`Recorrência ativa de ${reais(mrrCentavos)}/mês`);
  }
  if (
    (ctx.tarefas.length > 0 || ctx.compromissos.length > 0) &&
    tarefasAtrasadas.length === 0 &&
    compromissosVencidos.length === 0
  ) {
    sinaisPositivos.push("Nenhuma pendência atrasada");
  }
  if (oportunidadesAtivas.length > 0 && paradas === 0 && acaoAtrasadaDias === 0) {
    sinaisPositivos.push(
      plural(oportunidadesAtivas.length, "oportunidade em andamento", "oportunidades em andamento")
    );
  }

  // ── Portão 2: sem contato registrado não se afirma saúde ─────────────────
  //
  // Nenhum sinal ruim + nenhum contato registrado não é um cliente saudável: é um
  // cliente sobre cuja relação não se sabe nada. Um pagamento recebido prova que o
  // dinheiro entrou, não que a relação está viva. Cliente antigo nessa situação nem
  // chega aqui — o sinal SEM_HISTORICO_CONTATO já o colocou em Atenção.
  if (motivos.length === 0 && contatoMs === null) {
    return {
      ...contexto,
      status: "SEM_DADOS",
      score: CONFIG_SAUDE.SCORE_MAXIMO,
      motivos: [],
      sinaisPositivos,
      acaoRecomendada: ACAO_POR_SINAL.SEM_HISTORICO_CONTATO,
      resumo: clienteNovo
        ? diasDesdeCadastro === 0
          ? "Cadastrado hoje, ainda sem contato registrado"
          : `Cadastrado ${haDias(diasDesdeCadastro)}, ainda sem contato registrado`
        : "Nenhum contato registrado — sem base para diagnosticar",
    };
  }

  // ── Score e faixa ────────────────────────────────────────────────────────
  const descontos = motivos.reduce((s, m) => s + m.peso, 0);
  const score = Math.max(0, CONFIG_SAUDE.SCORE_MAXIMO - descontos);
  const status: StatusSaude =
    score >= CONFIG_SAUDE.LIMIAR_VERDE
      ? "VERDE"
      : score >= CONFIG_SAUDE.LIMIAR_AMARELO
        ? "AMARELO"
        : "VERMELHO";

  // ── Resumo e ação ────────────────────────────────────────────────────────
  //
  // A manchete de quem não está bem é o pior motivo; a de quem está bem é o que
  // sustenta a saúde. Um sinal fraco demais para mudar a faixa continua visível na
  // lista de motivos do diagnóstico, só não vira manchete.
  const principal = motivos[0] ?? null;
  const positivos = sinaisPositivos.slice(0, 2).join(" · ");
  const resumo =
    status === "VERDE"
      ? positivos || "Sem pendências registradas"
      : (principal?.texto ?? (positivos || "Sem pendências registradas"));

  return {
    ...contexto,
    status,
    score,
    motivos,
    sinaisPositivos,
    acaoRecomendada: principal ? ACAO_POR_SINAL[principal.chave] : null,
    resumo,
  };
}

// ─── Filtros secundários ─────────────────────────────────────────────────────

/**
 * Recortes por sinal, usados pelo "Filtrar" da tela de Saúde.
 *
 * Ficam aqui, e não na tela, porque "o que é pendência financeira" é a mesma
 * pergunta que a engine responde ao pontuar — a tela só escolhe o recorte.
 */
export type FiltroSinal =
  | "PENDENCIA_FINANCEIRA"
  | "SEM_CONTATO"
  | "PENDENCIA_ATRASADA"
  | "OPORTUNIDADE_PARADA";

export const FILTROS_SINAL: { chave: FiltroSinal; label: string }[] = [
  { chave: "PENDENCIA_FINANCEIRA", label: "Com pendência financeira" },
  { chave: "SEM_CONTATO", label: "Sem contato" },
  { chave: "PENDENCIA_ATRASADA", label: "Com tarefa ou compromisso atrasado" },
  { chave: "OPORTUNIDADE_PARADA", label: "Com oportunidade parada" },
];

export function atendeFiltro(d: DiagnosticoSaude, filtro: FiltroSinal): boolean {
  const tem = (chave: ChaveSinal) => d.motivos.some((m) => m.chave === chave);
  switch (filtro) {
    case "PENDENCIA_FINANCEIRA":
      return d.receitasVencidas > 0 || tem("RECORRENCIA_INTERROMPIDA");
    case "SEM_CONTATO":
      return tem("SEM_CONTATO") || tem("SEM_HISTORICO_CONTATO");
    case "PENDENCIA_ATRASADA":
      return d.tarefasAtrasadas > 0 || d.compromissosVencidos > 0;
    case "OPORTUNIDADE_PARADA":
      return d.oportunidadesParadas > 0 || tem("ACAO_COMERCIAL_ATRASADA");
  }
}
