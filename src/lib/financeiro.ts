// Camada financeira central — funções puras, sem dependências de framework.
//
// Toda pergunta de dinheiro do Command Center é respondida aqui: a tela de
// Financeiro, o painel de /negocio, a engine de Saúde, o Cliente 360° e o
// Pipeline importam destas funções em vez de recalcular. Se uma regra monetária
// não estiver neste arquivo, ela está no lugar errado.
//
// Convenções inegociáveis:
//   · dinheiro sempre em centavos inteiros — nunca Float;
//   · datas sempre comparadas em UTC, por dia (competência é dia 1 do mês, UTC);
//   · "vencida" nunca é um status gravado — é derivado, ver statusEfetivo().

// ─── Vocabulário ─────────────────────────────────────────────────────────────

/** Status como ficam gravados no banco. INADIMPLENTE é legado — ver statusEfetivo(). */
export const STATUS_GRAVADOS = [
  "PREVISTA",
  "CONFIRMADA",
  "RECEBIDA",
  "INADIMPLENTE",
  "CANCELADA",
] as const;
export type StatusGravado = (typeof STATUS_GRAVADOS)[number];

/** Os que o formulário oferece. INADIMPLENTE saiu: atraso agora é derivado. */
export const STATUS_ESCOLHIVEIS: StatusGravado[] = [
  "PREVISTA",
  "CONFIRMADA",
  "RECEBIDA",
  "CANCELADA",
];

/**
 * Status que a interface mostra. VENCIDA não existe no banco: é PREVISTA ou
 * CONFIRMADA cujo vencimento já passou (ou o legado INADIMPLENTE).
 */
export const STATUS_EFETIVOS = [
  "PREVISTA",
  "A_RECEBER",
  "RECEBIDA",
  "VENCIDA",
  "CANCELADA",
] as const;
export type StatusEfetivo = (typeof STATUS_EFETIVOS)[number];

export const STATUS_LABELS: Record<StatusEfetivo, string> = {
  PREVISTA: "Prevista",
  A_RECEBER: "A receber",
  RECEBIDA: "Recebida",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

/** Rótulo de cada status gravado, para o formulário. */
export const STATUS_GRAVADO_LABELS: Record<string, string> = {
  PREVISTA: "Prevista",
  CONFIRMADA: "A receber",
  RECEBIDA: "Recebida",
  INADIMPLENTE: "Vencida (legado)",
  CANCELADA: "Cancelada",
};

export const LINHAS = ["INNOBI", "MENTORIA", "SERVICOS"] as const;
export type Linha = (typeof LINHAS)[number];

export const LINHA_LABELS: Record<string, string> = {
  INNOBI: "Innobi",
  MENTORIA: "Mentoria",
  SERVICOS: "Serviços",
};

export const LINHA_CORES: Record<string, string> = {
  INNOBI: "#4F8CFF",
  MENTORIA: "#7C5CFF",
  SERVICOS: "#00D4FF",
};

export const TIPOS = ["RECORRENTE", "PONTUAL"] as const;
export type TipoReceita = (typeof TIPOS)[number];

export const TIPO_LABELS: Record<string, string> = {
  RECORRENTE: "Recorrente",
  PONTUAL: "Pontual",
};

export const CATEGORIAS_DESPESA = [
  "FERRAMENTAS",
  "PRESTADORES",
  "IMPOSTOS",
  "ANUNCIOS",
  "INFRA",
  "OUTROS",
] as const;

export const CATEGORIA_DESPESA_LABELS: Record<string, string> = {
  FERRAMENTAS: "Ferramentas",
  PRESTADORES: "Prestadores",
  IMPOSTOS: "Impostos",
  ANUNCIOS: "Anúncios",
  INFRA: "Infraestrutura",
  OUTROS: "Outras",
};

// ─── Formato de entrada ──────────────────────────────────────────────────────

/**
 * O mínimo que uma receita precisa expor para ser calculada. Aceita Date ou
 * string ISO para servir tanto ao servidor (Prisma) quanto ao cliente (JSON).
 */
export type ReceitaLike = {
  tipo: string;
  status: string;
  valorCentavos: number;
  linha?: string;
  competencia?: string | Date;
  vencimento?: string | Date | null;
  dataRecebida?: string | Date | null;
};

export type DespesaMes = { totalCentavos: number };

// ─── Datas ───────────────────────────────────────────────────────────────────

/** Meia-noite UTC do dia da data — a granularidade de toda comparação de prazo. */
function diaUTC(d: string | Date): number {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

/** Retorna o Date UTC do primeiro dia do mês a partir de "yyyy-MM". */
export function mesParaDate(mes: string): Date {
  const [year, month] = mes.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Retorna "yyyy-MM" a partir de um Date. */
export function dateParaMes(d: string | Date): string {
  const x = new Date(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Primeiro dia do mês seguinte — o limite superior exclusivo das consultas. */
export function proximoMes(inicio: Date): Date {
  return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
}

/** Último dia do mês da competência, em UTC. */
export function ultimoDiaDoMes(competencia: string | Date): Date {
  const c = new Date(competencia);
  return new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 0));
}

/** Retorna os últimos N meses (incluindo o de referência) como "yyyy-MM". */
export function ultimosMeses(n: number, referencia = new Date()): string[] {
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() - i, 1)
    );
    meses.push(dateParaMes(d));
  }
  return meses;
}

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "ago" — usado no eixo do gráfico. */
export function mesCurto(mes: string | Date): string {
  const d = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mesParaDate(mes) : new Date(mes);
  return MESES_CURTOS[d.getUTCMonth()];
}

/** "agosto de 2026" — usado no cabeçalho do mês selecionado. */
export function mesPorExtenso(mes: string): string {
  return mesParaDate(mes).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** "20 ago" — usado na coluna de vencimento. */
export function fmtDiaMes(data: string | Date): string {
  const d = new Date(data);
  return `${d.getUTCDate()} ${MESES_CURTOS[d.getUTCMonth()]}`;
}

/**
 * Interpreta "2026-08-20" (ou um ISO completo) como aquele dia em UTC puro.
 * Sem isto, o fuso do navegador desloca o vencimento em um dia para quem está
 * a oeste de Greenwich — e a receita nasce vencida.
 */
export function parseDataUTC(raw: string): Date {
  const [y, m, d] = raw.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-08-20" a partir de um Date — o formato que o input type="date" espera. */
export function fmtDataInput(data: string | Date): string {
  const d = new Date(data);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${dia}`;
}

/** Diferença em dias entre duas datas, contada em dias UTC. Positivo = futuro. */
export function diasAte(data: string | Date, agora: Date = new Date()): number {
  return Math.round((diaUTC(data) - diaUTC(agora)) / 86_400_000);
}

// ─── Status derivado ─────────────────────────────────────────────────────────

/**
 * Quando o dinheiro deve entrar.
 *
 * Receitas anteriores ao campo `vencimento` caem no último dia da competência —
 * é exatamente a régua que valia antes (competência passada = atrasada), então
 * nenhum registro histórico muda de comportamento ao migrar.
 */
export function vencimentoEfetivo(r: ReceitaLike): Date | null {
  if (r.vencimento) return new Date(r.vencimento);
  if (r.competencia) return ultimoDiaDoMes(r.competencia);
  return null;
}

export function isCancelada(r: ReceitaLike): boolean {
  return r.status === "CANCELADA";
}

export function isRecebida(r: ReceitaLike): boolean {
  return r.status === "RECEBIDA";
}

/**
 * Vencida = tem vencimento no passado e o dinheiro não entrou. O legado
 * INADIMPLENTE continua contando como vencida, para não perder marcações manuais.
 * Cancelada nunca vence.
 */
export function isVencida(r: ReceitaLike, agora: Date = new Date()): boolean {
  if (isRecebida(r) || isCancelada(r)) return false;
  if (r.status === "INADIMPLENTE") return true;
  const venc = vencimentoEfetivo(r);
  if (!venc) return false;
  return diaUTC(venc) < diaUTC(agora);
}

/** O único lugar do sistema que decide como uma receita é rotulada. */
export function statusEfetivo(r: ReceitaLike, agora: Date = new Date()): StatusEfetivo {
  if (isCancelada(r)) return "CANCELADA";
  if (isRecebida(r)) return "RECEBIDA";
  if (isVencida(r, agora)) return "VENCIDA";
  return r.status === "CONFIRMADA" ? "A_RECEBER" : "PREVISTA";
}

/** Dias de atraso de uma receita vencida. 0 para as que não estão vencidas. */
export function diasEmAtraso(r: ReceitaLike, agora: Date = new Date()): number {
  if (!isVencida(r, agora)) return 0;
  const venc = vencimentoEfetivo(r);
  if (!venc) return 0;
  return Math.max(1, -diasAte(venc, agora));
}

/** Entra em qualquer soma de dinheiro? Cancelada nunca entra. */
export function contaComoReceita(r: ReceitaLike): boolean {
  return !isCancelada(r);
}

// ─── Somas do mês ────────────────────────────────────────────────────────────

function soma(receitas: ReceitaLike[]): number {
  return receitas.reduce((s, r) => s + r.valorCentavos, 0);
}

/**
 * Uma receita entra no MRR quando é recorrente, está contratada (confirmada ou
 * já recebida) e não foi cancelada. Prevista não entra: ainda não é acordo firme.
 * Pontual nunca entra. Vencida também não — dinheiro atrasado não é receita
 * recorrente saudável, e o vencido tem indicador próprio.
 */
export function contaParaMRR(r: ReceitaLike, agora: Date = new Date()): boolean {
  if (r.tipo !== "RECORRENTE") return false;
  if (isCancelada(r)) return false;
  if (isVencida(r, agora)) return false;
  return r.status === "CONFIRMADA" || r.status === "RECEBIDA";
}

/** MRR da competência: recorrentes contratadas e em dia. */
export function calcMRR(receitas: ReceitaLike[], agora: Date = new Date()): number {
  return soma(receitas.filter((r) => contaParaMRR(r, agora)));
}

/** MRR por linha de receita — retorna { INNOBI, MENTORIA, SERVICOS }. */
export function calcMRRPorLinha(
  receitas: ReceitaLike[],
  agora: Date = new Date()
): Record<string, number> {
  const acc: Record<string, number> = { INNOBI: 0, MENTORIA: 0, SERVICOS: 0 };
  for (const r of receitas) {
    if (!contaParaMRR(r, agora)) continue;
    if (r.linha && r.linha in acc) acc[r.linha] += r.valorCentavos;
  }
  return acc;
}

/** Tudo que entrou de fato na competência, recorrente e pontual. */
export function calcRecebido(receitas: ReceitaLike[]): number {
  return soma(receitas.filter(isRecebida));
}

/** A fatia pontual do que entrou — o detalhe sob "Recebido no mês". */
export function calcRecebidoPontual(receitas: ReceitaLike[]): number {
  return soma(receitas.filter((r) => isRecebida(r) && r.tipo === "PONTUAL"));
}

/** Receita pontual da competência, recebida ou não (exclui canceladas). */
export function calcReceitaPontual(receitas: ReceitaLike[]): number {
  return soma(receitas.filter((r) => r.tipo === "PONTUAL" && contaComoReceita(r)));
}

/**
 * Quanto ainda tem de entrar: tudo que não foi recebido nem cancelado.
 * Inclui prevista, confirmada e vencida — a pergunta é "quanto falta entrar",
 * e o quanto disso está atrasado sai em calcVencido().
 */
export function calcAReceber(receitas: ReceitaLike[]): number {
  return soma(receitas.filter((r) => !isRecebida(r) && !isCancelada(r)));
}

/** Quanto do "a receber" já passou do vencimento. */
export function calcVencido(receitas: ReceitaLike[], agora: Date = new Date()): number {
  return soma(receitas.filter((r) => isVencida(r, agora)));
}

/** Quanto vence nos próximos N dias (hoje incluso), fora o que já venceu. */
export function calcAVencer(
  receitas: ReceitaLike[],
  dias: number,
  agora: Date = new Date()
): number {
  return soma(
    receitas.filter((r) => {
      if (isRecebida(r) || isCancelada(r) || isVencida(r, agora)) return false;
      const venc = vencimentoEfetivo(r);
      if (!venc) return false;
      const d = diasAte(venc, agora);
      return d >= 0 && d <= dias;
    })
  );
}

/** Variação percentual entre dois valores em centavos. */
export function calcVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

// ─── Runway ──────────────────────────────────────────────────────────────────

export type MotivoRunway = "OK" | "SEM_SALDO" | "SEM_DESPESAS";

export interface Runway {
  meses: number | null;
  motivo: MotivoRunway;
  burnMedioCentavos: number;
}

/**
 * Por quantos meses o caixa sustenta a operação no burn médio observado.
 *
 * Devolve null — e o motivo — em vez de inventar número: sem despesas lançadas
 * não existe burn, e sem saldo informado não existe caixa. Runway chutado é pior
 * que runway ausente.
 */
export function calcRunway(saldoCentavos: number, despesasPorMes: DespesaMes[]): Runway {
  const meses = despesasPorMes.length;
  const burnMedioCentavos =
    meses > 0
      ? Math.round(despesasPorMes.reduce((s, m) => s + m.totalCentavos, 0) / meses)
      : 0;

  if (burnMedioCentavos <= 0) {
    return { meses: null, motivo: "SEM_DESPESAS", burnMedioCentavos: 0 };
  }
  if (saldoCentavos <= 0) {
    return { meses: null, motivo: "SEM_SALDO", burnMedioCentavos };
  }
  return {
    meses: Math.floor(saldoCentavos / burnMedioCentavos),
    motivo: "OK",
    burnMedioCentavos,
  };
}

/** A frase que explica um runway ausente, sem prometer o que não temos. */
export function dicaRunway(runway: Runway): string {
  if (runway.motivo === "SEM_DESPESAS") return "lance despesas para calcular";
  if (runway.motivo === "SEM_SALDO") return "informe o saldo em caixa";
  return `burn ${fmtBRL(runway.burnMedioCentavos)}/mês`;
}

// ─── Resumo do mês ───────────────────────────────────────────────────────────

export interface ResumoFinanceiro {
  /** MRR da competência selecionada. */
  mrrAtual: number;
  mrrVariacao: number | null;
  mrrAnterior: number;
  /** Entrou de fato no mês. */
  recebido: number;
  recebidoPontual: number;
  /** Pontual da competência, recebida ou não — preservado do modelo antigo. */
  receitaPontual: number;
  /** Não recebida e não cancelada. */
  aReceber: number;
  vencido: number;
  aVencer7Dias: number;
  runway: number | null;
  runwayMotivo: MotivoRunway;
  burnMedioCentavos: number;
  despesasMes: number;
  saldoCaixa: number;
}

/**
 * Monta o resumo do mês a partir dos dados crus.
 * Usado pela tela de Financeiro, pelo painel de /negocio e pela home — a regra
 * vive só aqui, e todas as telas mostram exatamente o mesmo número.
 *
 * `receitasEmAberto` é a base do vencido: são as receitas ainda não recebidas de
 * QUALQUER competência, não só as do mês. Sem isso, um atraso de junho sumiria
 * ao navegar para agosto.
 */
export function calcResumoFinanceiro(params: {
  receitasMes: ReceitaLike[];
  receitasMesAnterior: ReceitaLike[];
  receitasEmAberto?: ReceitaLike[];
  saldoCentavos: number;
  despesasPorMes: DespesaMes[];
  despesasMesCentavos?: number;
  agora?: Date;
}): ResumoFinanceiro {
  const agora = params.agora ?? new Date();
  const emAberto = params.receitasEmAberto ?? params.receitasMes;

  const mrrAtual = calcMRR(params.receitasMes, agora);
  const mrrAnterior = calcMRR(params.receitasMesAnterior, agora);
  const runway = calcRunway(params.saldoCentavos, params.despesasPorMes);

  return {
    mrrAtual,
    mrrAnterior,
    mrrVariacao: calcVariacao(mrrAtual, mrrAnterior),
    recebido: calcRecebido(params.receitasMes),
    recebidoPontual: calcRecebidoPontual(params.receitasMes),
    receitaPontual: calcReceitaPontual(params.receitasMes),
    aReceber: calcAReceber(emAberto),
    vencido: calcVencido(emAberto, agora),
    aVencer7Dias: calcAVencer(emAberto, 7, agora),
    runway: runway.meses,
    runwayMotivo: runway.motivo,
    burnMedioCentavos: runway.burnMedioCentavos,
    despesasMes: params.despesasMesCentavos ?? 0,
    saldoCaixa: params.saldoCentavos,
  };
}

// ─── Receita por linha de negócio ────────────────────────────────────────────

export interface LinhaResumo {
  linha: string;
  label: string;
  cor: string;
  totalCentavos: number;
  recebidoCentavos: number;
  recorrenteCentavos: number;
  percentual: number;
}

/**
 * Quanto cada linha representa no mês. O percentual é sobre o total do mês —
 * linhas zeradas ficam na lista para a comparação não mudar de forma a cada mês.
 */
export function calcPorLinha(
  receitas: ReceitaLike[],
  agora: Date = new Date()
): LinhaResumo[] {
  const validas = receitas.filter(contaComoReceita);
  const total = soma(validas);

  return LINHAS.map((linha) => {
    const daLinha = validas.filter((r) => r.linha === linha);
    const totalCentavos = soma(daLinha);
    return {
      linha,
      label: LINHA_LABELS[linha],
      cor: LINHA_CORES[linha],
      totalCentavos,
      recebidoCentavos: calcRecebido(daLinha),
      recorrenteCentavos: calcMRR(daLinha, agora),
      percentual: total > 0 ? Math.round((totalCentavos / total) * 100) : 0,
    };
  }).sort((a, b) => b.totalCentavos - a.totalCentavos);
}

// ─── Principais clientes ─────────────────────────────────────────────────────

export type ReceitaComCliente = ReceitaLike & {
  clienteId?: string | null;
  clienteNome?: string | null;
};

export interface ClienteReceita {
  clienteId: string;
  nome: string;
  totalCentavos: number;
  recebidoCentavos: number;
  mrrCentavos: number;
  vencidoCentavos: number;
}

/**
 * Quem gera a receita do período, do maior para o menor. Receita sem cliente
 * vinculado fica de fora: a seção existe para levar ao perfil 360°.
 */
export function calcTopClientes(
  receitas: ReceitaComCliente[],
  limite = 5,
  agora: Date = new Date()
): ClienteReceita[] {
  const porCliente = new Map<string, ReceitaComCliente[]>();

  for (const r of receitas) {
    if (!r.clienteId || !contaComoReceita(r)) continue;
    const lista = porCliente.get(r.clienteId);
    if (lista) lista.push(r);
    else porCliente.set(r.clienteId, [r]);
  }

  return [...porCliente.entries()]
    .map(([clienteId, lista]) => ({
      clienteId,
      nome: lista.find((r) => r.clienteNome)?.clienteNome ?? "Cliente",
      totalCentavos: soma(lista),
      recebidoCentavos: calcRecebido(lista),
      mrrCentavos: calcMRR(lista, agora),
      vencidoCentavos: calcVencido(lista, agora),
    }))
    .filter((c) => c.totalCentavos > 0)
    .sort((a, b) => b.totalCentavos - a.totalCentavos)
    .slice(0, limite);
}

// ─── Evolução ────────────────────────────────────────────────────────────────

export interface PontoEvolucao {
  mes: string;
  label: string;
  INNOBI: number;
  MENTORIA: number;
  SERVICOS: number;
  recorrente: number;
  pontual: number;
  total: number;
}

/**
 * Série mensal da receita para o gráfico. Cada ponto soma o que foi contratado
 * naquela competência (canceladas fora), separando por linha e por natureza.
 */
export function calcEvolucao(
  meses: { mes: string; receitas: ReceitaLike[] }[],
  agora: Date = new Date()
): PontoEvolucao[] {
  return meses.map(({ mes, receitas }) => {
    const validas = receitas.filter(contaComoReceita);
    const porLinha = validas.reduce<Record<string, number>>(
      (acc, r) => {
        if (r.linha && r.linha in acc) acc[r.linha] += r.valorCentavos;
        return acc;
      },
      { INNOBI: 0, MENTORIA: 0, SERVICOS: 0 }
    );

    return {
      mes,
      label: mesCurto(mes),
      INNOBI: porLinha.INNOBI,
      MENTORIA: porLinha.MENTORIA,
      SERVICOS: porLinha.SERVICOS,
      recorrente: calcMRR(validas, agora),
      pontual: soma(validas.filter((r) => r.tipo === "PONTUAL")),
      total: soma(validas),
    };
  });
}

/**
 * Vale desenhar o gráfico? Um gráfico de 6 colunas vazias ocupa espaço e não
 * informa nada — abaixo de dois meses com movimento, a tela mostra uma linha.
 */
export function temHistoricoSuficiente(serie: PontoEvolucao[]): boolean {
  return serie.filter((p) => p.total > 0).length >= 2;
}

// ─── Projeção ────────────────────────────────────────────────────────────────

/**
 * O que está contratado para vencer nos próximos 30 dias. Determinístico: só lê
 * receitas já registradas. Oportunidade aberta é pipeline, não previsão de caixa.
 */
export function calcProjecao30Dias(
  receitas: ReceitaLike[],
  agora: Date = new Date()
): number {
  return calcAVencer(receitas, 30, agora);
}

// ─── Recorrência ─────────────────────────────────────────────────────────────

export type ReceitaRecorrente = ReceitaLike & {
  id: string;
  contratoId?: string | null;
};

/**
 * Quais recorrências de um mês ainda não têm competência lançada no mês alvo.
 *
 * É o que sustenta o botão "lançar recorrentes do mês": em vez de um motor de
 * cobrança com competências virtuais, cada mês continua sendo uma linha real —
 * o que mantém status, recebimento e vencimento funcionando igual para todos.
 * O contratoId é a trava contra lançar a mesma mensalidade duas vezes.
 */
export function recorrentesPendentes(
  origem: ReceitaRecorrente[],
  destino: ReceitaRecorrente[]
): ReceitaRecorrente[] {
  const jaLancados = new Set(
    destino.map((r) => r.contratoId ?? r.id).filter((v): v is string => Boolean(v))
  );

  const vistos = new Set<string>();
  const pendentes: ReceitaRecorrente[] = [];

  for (const r of origem) {
    if (r.tipo !== "RECORRENTE" || isCancelada(r)) continue;
    const contrato = r.contratoId ?? r.id;
    if (jaLancados.has(contrato) || vistos.has(contrato)) continue;
    vistos.add(contrato);
    pendentes.push(r);
  }

  return pendentes;
}

// ─── Formatação ──────────────────────────────────────────────────────────────

/** Formata centavos em R$. */
export function fmtBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/** "R$ 12,5 mil" — para eixos de gráfico, onde o valor cheio não cabe. */
export function fmtBRLCompacto(centavos: number): string {
  const reais = centavos / 100;
  if (Math.abs(reais) >= 1000) {
    const mil = reais / 1000;
    return `R$ ${mil.toFixed(mil % 1 === 0 ? 0 : 1).replace(".", ",")}k`;
  }
  return `R$ ${Math.round(reais)}`;
}

/** Converte input do usuário (reais pt-BR ou en-US) em centavos Int. */
export function parseBRL(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/g, "");
  // pt-BR: "1.997,50" → ponto é milhar, vírgula é decimal
  // en-US: "1997.50"  → ponto é decimal
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = parseFloat(normalized || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** "+8,7%" / "−3,2%" — a variação como ela aparece na faixa executiva. */
export function fmtVariacao(variacao: number): string {
  const sinal = variacao >= 0 ? "+" : "−";
  return `${sinal}${Math.abs(variacao).toFixed(1).replace(".", ",")}%`;
}
