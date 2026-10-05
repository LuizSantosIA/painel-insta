import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { carregarBriefing } from "@/lib/hoje-server";
import { carregarResumo, mesCorrente } from "@/lib/financeiro-server";
import { INCLUDE_SAUDE, diagnosticarCliente } from "@/lib/saude-server";
import { carregarMaquina } from "@/lib/maquina-dados";
import { LABEL_FONTE } from "@/lib/hoje";
import { ESTAGIOS_PIPELINE, calcResumoPipeline, diasNoEstagio, labelEstagio, tomTempoParado } from "@/lib/pipeline";
import { LABEL_ETAPA, LABEL_OBJETIVO } from "@/lib/engine/etapas";
import { dinheiro, data, dataHora, lista, plural, quando, resumir, secoes, titulo } from "./formato";

/**
 * As ferramentas que o Command Center expõe para um agente externo — o Jarvis
 * rodando na sua máquina, o Claude Desktop, qualquer cliente MCP.
 *
 * Fase 1: só leitura. Nada aqui escreve, publica, cobra ou manda mensagem; as
 * ferramentas de escrita entram depois, com confirmação explícita.
 *
 * A saída é TEXTO, não JSON: quem lê é um modelo, às vezes um modelo local
 * pequeno. Sempre que a próxima pergunta puder precisar de um id, o id vai
 * junto do nome.
 */

export interface Ferramenta {
  nome: string;
  titulo: string;
  descricao: string;
  /** Schema zod dos argumentos. Objeto vazio = ferramenta sem argumento. */
  schema: z.ZodObject<z.ZodRawShape>;
  /** Fase 1 é toda somenteLeitura; fica explícito para o cliente MCP anotar. */
  somenteLeitura: boolean;
  executar: (args: Record<string, unknown>) => Promise<string>;
}

const vazio = z.object({});

// ─── Hoje ────────────────────────────────────────────────────────────────────

const hoje: Ferramenta = {
  nome: "hoje",
  titulo: "O que precisa de decisão hoje",
  descricao:
    "O dia inteiro do Command Center: o que é urgente, o que pede atenção, os compromissos de hoje, as tarefas e o que vence nos próximos dias. Comece por aqui quando a pergunta for aberta ('o que tem para hoje?', 'o que é mais urgente?', 'como está o dia?').",
  schema: vazio,
  somenteLeitura: true,
  async executar() {
    const b = await carregarBriefing();
    const fontes = Object.entries(b.porFonte)
      .filter(([, n]) => n > 0)
      .map(([f, n]) => `${LABEL_FONTE[f as keyof typeof LABEL_FONTE]}: ${n}`)
      .join(" · ");

    return secoes(
      `${titulo("Hoje")}\n${b.resumo}${fontes ? `\n${fontes}` : ""}`,
      `${titulo("Precisa de decisão")}\n${lista(
        b.prioridades.slice(0, 15).map((p) => `[${p.severidade}] ${p.titulo} — ${p.detalhe} · ${p.acaoLabel} · ${p.destino}`),
        "Nada pendente."
      )}`,
      `${titulo("Agenda de hoje")}\n${lista(
        b.agenda.map((a) => `${a.hora ?? "sem hora"} ${a.titulo} — ${a.detalhe}`),
        "Sem compromisso hoje."
      )}`,
      `${titulo("Tarefas de hoje")}\n${lista(
        b.tarefas.map((t) => `${t.title}${t.clienteNome ? ` · ${t.clienteNome}` : ""} [${t.priority}]`),
        "Sem tarefa para hoje."
      )}`,
      `${titulo("Próximos dias")}\n${lista(
        b.proximos.slice(0, 10).map((p) => `em ${plural(p.emDias, "dia")}: ${p.titulo} — ${p.detalhe}`),
        "Nada nos próximos dias."
      )}`
    );
  },
};

// ─── Máquina de conteúdo ─────────────────────────────────────────────────────

const maquinaStatus: Ferramenta = {
  nome: "maquina_status",
  titulo: "Status da máquina de conteúdo",
  descricao:
    "Em que pé está a máquina de conteúdo: o que está aguardando sua aprovação, o que está em produção, o que está agendado, o modo (MANUAL/COPILOTO/AUTOPILOT) e se as chaves de IA, imagem e Instagram estão configuradas.",
  schema: vazio,
  somenteLeitura: true,
  async executar() {
    const [posts, config, maquina, execucoesHoje] = await Promise.all([
      prisma.post.findMany({
        where: { etapa: { not: null }, NOT: { etapa: { in: ["PUBLICADO", "REPROVADO"] } } },
        select: { id: true, tituloInterno: true, etapa: true, objetivo: true, scoreFinal: true, agendadoPara: true, tema: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      prisma.config.findUnique({ where: { id: "singleton" } }),
      carregarMaquina(),
      (async () => {
        const inicio = new Date();
        inicio.setHours(0, 0, 0, 0);
        return prisma.execucaoAgente.count({ where: { criadoEm: { gte: inicio } } });
      })(),
    ]);

    const de = (etapa: string) => posts.filter((p) => p.etapa === etapa);
    const linha = (p: (typeof posts)[number]) =>
      `${p.tituloInterno ?? p.tema ?? "sem título"} · id ${p.id}${p.objetivo ? ` · ${LABEL_OBJETIVO[p.objetivo as keyof typeof LABEL_OBJETIVO] ?? p.objetivo}` : ""}${p.scoreFinal ? ` · nota ${p.scoreFinal}` : ""}${p.agendadoPara ? ` · ${dataHora(p.agendadoPara)}` : ""}`;

    const producao = posts.filter((p) => ["SELECIONADA", "COPY", "DESIGN", "REVISAO"].includes(p.etapa ?? ""));
    const pronto = [
      process.env.AI_GATEWAY_API_KEY ? "IA ok" : "IA FALTANDO (AI_GATEWAY_API_KEY)",
      process.env.BLOB_READ_WRITE_TOKEN ? "imagens ok" : "imagens FALTANDO (BLOB_READ_WRITE_TOKEN)",
      maquina.meta.instagramConectado ? "Instagram ok" : "Instagram desconectado",
    ].join(" · ");

    return secoes(
      `${titulo("Máquina de conteúdo")}\nModo ${config?.modoMaquina ?? "COPILOTO"} · ${execucoesHoje}/${config?.tetoExecucoesDia ?? 60} execuções hoje\n${pronto}`,
      `${titulo("Aguardando sua aprovação")}\n${lista(de("AGUARDANDO_APROVACAO").map(linha), "Fila vazia.")}`,
      `${titulo("Em produção")}\n${lista(
        producao.map((p) => `${LABEL_ETAPA[p.etapa as keyof typeof LABEL_ETAPA] ?? p.etapa}: ${linha(p)}`),
        "Nada rodando."
      )}`,
      `${titulo("Agendados")}\n${lista(de("AGENDADO").map(linha), "Nenhum agendado.")}`,
      "Para ver um post inteiro use post_detalhe com o id."
    );
  },
};

const postDetalhe: Ferramenta = {
  nome: "post_detalhe",
  titulo: "Detalhe de um post da máquina",
  descricao:
    "Um post da máquina de conteúdo por inteiro: ideia, nota, slide a slide com o texto de cada um, legenda final, CTA, o que o fact-checker apontou e o parecer do revisor. Use o id que maquina_status devolveu.",
  schema: z.object({ id: z.string().describe("id do post, como aparece em maquina_status") }),
  somenteLeitura: true,
  async executar(args) {
    const id = String(args.id ?? "");
    const p = await prisma.post.findUnique({
      where: { id },
      include: {
        slides: { orderBy: { ordem: "asc" } },
        estiloVisual: { select: { nome: true } },
        revisoes: { orderBy: { criadoEm: "desc" }, take: 5 },
        execucoes: {
          where: { agente: { in: ["FACT_CHECKER", "REVISOR"] } },
          orderBy: { criadoEm: "desc" },
          take: 4,
          select: { agente: true, status: true, saida: true, erro: true },
        },
      },
    });
    if (!p) return `Não existe post com id ${id}. Use maquina_status para listar os ids.`;

    const scores = p.scoreEstrategia ? (JSON.parse(p.scoreEstrategia) as Record<string, number>) : null;

    return secoes(
      `${titulo(p.tituloInterno ?? p.tema ?? "Post")}\n` +
        [
          `id ${p.id}`,
          `etapa ${LABEL_ETAPA[p.etapa as keyof typeof LABEL_ETAPA] ?? p.etapa ?? "—"}`,
          p.objetivo && `objetivo ${LABEL_OBJETIVO[p.objetivo as keyof typeof LABEL_OBJETIVO] ?? p.objetivo}`,
          p.tipoConteudo && `tipo ${p.tipoConteudo}`,
          p.scoreFinal && `nota final ${p.scoreFinal}`,
          p.estiloVisual && `visual ${p.estiloVisual.nome}`,
          p.agendadoPara && `agendado para ${dataHora(p.agendadoPara)}`,
        ]
          .filter(Boolean)
          .join(" · ") +
        (scores ? `\nscores: ${Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(" · ")}` : ""),
      `${titulo("Slides")}\n${lista(
        p.slides.map(
          (s) =>
            `slide ${s.ordem} [${s.layout}]${s.imagemUrl ? "" : " (imagem não gerada)"}: ${[s.headline, s.corpo, s.microcopy].filter(Boolean).join(" / ")}`
        ),
        "Nenhum slide escrito ainda."
      )}`,
      p.legendaFinal ? `${titulo("Legenda")}\n${p.legendaFinal}` : null,
      p.palavraChave ? `${titulo("CTA")}\nPalavra-chave: ${p.palavraChave}` : null,
      `${titulo("Pareceres")}\n${lista(
        p.execucoes.map((e) => `${e.agente} [${e.status}]: ${resumir(e.erro ?? e.saida, 400)}`),
        "Ainda não passou por fact-check nem revisão."
      )}`,
      p.revisoes.length
        ? `${titulo("Suas decisões")}\n${lista(
            p.revisoes.map((r) => `${dataHora(r.criadoEm)} ${r.decisao}${r.escopo ? ` (${r.escopo})` : ""}${r.motivo ? `: ${r.motivo}` : ""}`),
            ""
          )}`
        : null
    );
  },
};

// ─── Clientes ────────────────────────────────────────────────────────────────

const clientes: Ferramenta = {
  nome: "clientes",
  titulo: "Clientes e saúde da carteira",
  descricao:
    "Lista os clientes ativos com o diagnóstico de saúde de cada um — VERMELHO (em risco), AMARELO (atenção), VERDE (saudável) —, dias sem contato e a ação recomendada. Use para 'quais clientes estão em risco?' ou 'quem eu não falo há muito tempo?'.",
  schema: z.object({
    status: z
      .enum(["TODOS", "VERMELHO", "AMARELO", "VERDE"])
      .default("TODOS")
      .describe("filtra pela saúde: VERMELHO em risco, AMARELO atenção, VERDE saudável"),
  }),
  somenteLeitura: true,
  async executar(args) {
    const filtro = String(args.status ?? "TODOS");
    const agora = new Date();
    const lista_ = await prisma.client.findMany({
      where: { arquivadoEm: null, status: { in: ["active", "lead"] } },
      include: INCLUDE_SAUDE,
    });

    const comDiag = lista_
      .map((c) => ({ c, d: diagnosticarCliente(c, agora) }))
      .filter(({ d }) => filtro === "TODOS" || d.status === filtro)
      .sort((a, b) => a.d.score - b.d.score);

    if (!comDiag.length) return filtro === "TODOS" ? "Nenhum cliente ativo." : `Nenhum cliente em ${filtro}.`;

    return secoes(
      `${titulo("Clientes")}\n${plural(comDiag.length, "cliente")}${filtro !== "TODOS" ? ` em ${filtro}` : ""}`,
      lista(
        comDiag.map(
          ({ c, d }) =>
            `[${d.status}] ${c.name} · id ${c.id} · ${d.resumo}${d.diasSemContato !== null ? ` · ${plural(d.diasSemContato, "dia")} sem contato` : ""}${d.acaoRecomendada ? ` · ação: ${d.acaoRecomendada.label}` : ""}`
        ),
        ""
      ),
      "Para o histórico completo de um cliente use cliente_detalhe com o id."
    );
  },
};

const clienteDetalhe: Ferramenta = {
  nome: "cliente_detalhe",
  titulo: "Ficha 360 de um cliente",
  descricao:
    "Tudo sobre um cliente: contato, receita que ele gera, contratos vigentes, tarefas e compromissos em aberto, últimas interações e qual é a próxima ação recomendada.",
  schema: z.object({ id: z.string().describe("id do cliente, ou parte do nome") }),
  somenteLeitura: true,
  async executar(args) {
    const busca = String(args.id ?? "").trim();
    const cliente =
      (await prisma.client.findUnique({ where: { id: busca }, include: INCLUDE_SAUDE })) ??
      (await prisma.client.findFirst({
        where: { name: { contains: busca }, arquivadoEm: null },
        include: INCLUDE_SAUDE,
      }));
    if (!cliente) return `Não achei cliente com id ou nome "${busca}". Use a ferramenta clientes para listar.`;

    const agora = new Date();
    const d = diagnosticarCliente(cliente, agora);
    const [receitas, tarefas, compromissos, interacoes] = await Promise.all([
      prisma.receita.findMany({ where: { clienteId: cliente.id }, orderBy: { competencia: "desc" }, take: 8 }),
      prisma.task.findMany({ where: { clientId: cliente.id, done: false }, orderBy: { dueDate: "asc" } }),
      prisma.compromisso.findMany({ where: { clienteId: cliente.id, cumprido: false }, orderBy: { prazoEm: "asc" } }),
      prisma.interacao.findMany({ where: { clienteId: cliente.id }, orderBy: { ocorreuEm: "desc" }, take: 6 }),
    ]);

    const recebido = receitas.filter((r) => r.status === "RECEBIDA").reduce((s, r) => s + r.valorCentavos, 0);

    return secoes(
      `${titulo(cliente.name)}\n` +
        [
          `id ${cliente.id}`,
          `status ${cliente.status}`,
          cliente.company,
          cliente.email,
          cliente.phone,
          cliente.instagram && `@${cliente.instagram.replace(/^@/, "")}`,
        ]
          .filter(Boolean)
          .join(" · "),
      `${titulo("Saúde")}\n[${d.status}] ${d.resumo}${d.acaoRecomendada ? `\nAção recomendada: ${d.acaoRecomendada.label}` : ""}${
        d.motivos.length ? `\nMotivos: ${d.motivos.map((m) => m.texto).join(" · ")}` : ""
      }`,
      `${titulo("Dinheiro")}\nRecebido no histórico: ${dinheiro(recebido)}\n${lista(
        receitas.map((r) => `${data(r.competencia)} ${r.descricao} ${dinheiro(r.valorCentavos)} [${r.status}] ${r.tipo}`),
        "Nenhuma receita registrada."
      )}`,
      `${titulo("Em aberto")}\n${lista(
        [
          ...tarefas.map((t) => `tarefa: ${t.title}${t.dueDate ? ` · ${quando(t.dueDate, agora)}` : ""}`),
          ...compromissos.map((c) => `promessa: ${c.descricao} · ${quando(c.prazoEm, agora)}`),
        ],
        "Nada em aberto."
      )}`,
      `${titulo("Últimas interações")}\n${lista(
        interacoes.map((i) => `${data(i.ocorreuEm)} [${i.tipo}] ${resumir(i.nota, 110)}`),
        "Nenhuma interação registrada."
      )}`
    );
  },
};

// ─── Dinheiro ────────────────────────────────────────────────────────────────

const financeiro: Ferramenta = {
  nome: "financeiro",
  titulo: "Financeiro do mês",
  descricao:
    "Os números do mês: MRR e variação, quanto entrou, quanto falta receber, quanto está vencido, despesas, saldo em caixa e runway. Use para 'quanto entrou esse mês?', 'tem alguma coisa vencida?', 'quanto tempo de caixa eu tenho?'.",
  schema: z.object({
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("mês no formato aaaa-mm; omitido = mês corrente"),
  }),
  somenteLeitura: true,
  async executar(args) {
    const mes = (args.mes as string) || mesCorrente();
    const r = await carregarResumo(mes);
    const vencidas = await prisma.receita.findMany({
      where: { status: { notIn: ["RECEBIDA", "CANCELADA"] }, vencimento: { lt: new Date() } },
      include: { cliente: { select: { name: true } } },
      orderBy: { vencimento: "asc" },
      take: 10,
    });

    return secoes(
      `${titulo(`Financeiro ${mes}`)}\n` +
        [
          `MRR ${dinheiro(r.mrrAtual)}${r.mrrVariacao !== null ? ` (${r.mrrVariacao > 0 ? "+" : ""}${r.mrrVariacao.toFixed(1)}%)` : ""}`,
          `recebido ${dinheiro(r.recebido)}`,
          `a receber ${dinheiro(r.aReceber)}`,
          `vencido ${dinheiro(r.vencido)}`,
          `vence em 7 dias ${dinheiro(r.aVencer7Dias)}`,
        ].join(" · ") +
        `\n${[
          `despesas ${dinheiro(r.despesasMes)}`,
          `caixa ${dinheiro(r.saldoCaixa)}`,
          `burn médio ${dinheiro(r.burnMedioCentavos)}`,
          r.runway !== null ? `runway ${r.runway.toFixed(1)} meses` : `runway indisponível (${r.runwayMotivo})`,
        ].join(" · ")}`,
      `${titulo("Vencidas")}\n${lista(
        vencidas.map((v) => `${data(v.vencimento)} ${v.descricao}${v.cliente ? ` · ${v.cliente.name}` : ""} ${dinheiro(v.valorCentavos)}`),
        "Nada vencido."
      )}`
    );
  },
};

// ─── Pipeline ────────────────────────────────────────────────────────────────

const pipeline: Ferramenta = {
  nome: "pipeline",
  titulo: "Pipeline comercial",
  descricao:
    "Oportunidades abertas por estágio, valor total, ticket médio e quem está parado há tempo demais. Use para 'como está o pipeline?', 'quem está travado?', 'quanto tem em negociação?'.",
  schema: z.object({
    parados: z.boolean().default(false).describe("true = mostra só quem está parado há mais de 7 dias"),
  }),
  somenteLeitura: true,
  async executar(args) {
    const soParados = args.parados === true;
    const agora = new Date();
    const leads = await prisma.lead.findMany({
      where: { estagio: { notIn: ["GANHO", "PERDIDO"] } },
      orderBy: { atualizadoEm: "asc" },
    });
    const resumo = calcResumoPipeline(leads.map((l) => ({ estagio: l.estagio, valorEstimadoCentavos: l.valorEstimadoCentavos })));

    const comTempo = leads.map((l) => ({ l, dias: diasNoEstagio(l.estagioDesde ?? l.atualizadoEm, agora) }));
    const visiveis = soParados ? comTempo.filter(({ dias }) => tomTempoParado(dias) !== "NEUTRO") : comTempo;

    const porEstagio = ESTAGIOS_PIPELINE.map((e) => {
      const n = leads.filter((l) => l.estagio === e).length;
      return n ? `${labelEstagio(e)}: ${n}` : null;
    }).filter(Boolean);

    return secoes(
      `${titulo("Pipeline")}\n${plural(resumo.quantidade, "oportunidade")} abertas · ${dinheiro(resumo.totalCentavos)}${
        resumo.ticketMedioCentavos ? ` · ticket médio ${dinheiro(resumo.ticketMedioCentavos)}` : ""
      }${porEstagio.length ? `\n${porEstagio.join(" · ")}` : ""}`,
      `${titulo(soParados ? "Parados" : "Oportunidades")}\n${lista(
        visiveis
          .slice(0, 20)
          .map(
            ({ l, dias }) =>
              `[${labelEstagio(l.estagio)}] ${l.nome} · id ${l.id}${l.valorEstimadoCentavos ? ` · ${dinheiro(l.valorEstimadoCentavos)}` : ""}${
                dias !== null ? ` · ${plural(dias, "dia")} no estágio${tomTempoParado(dias) !== "NEUTRO" ? ` (${tomTempoParado(dias)})` : ""}` : ""
              }${l.proximaAcao ? ` · próxima: ${l.proximaAcao}${l.proximaAcaoEm ? ` ${quando(l.proximaAcaoEm, agora)}` : ""}` : " · SEM PRÓXIMA AÇÃO"}`
          ),
        soParados ? "Ninguém parado — pipeline em dia." : "Pipeline vazio."
      )}`
    );
  },
};

// ─── Instagram ───────────────────────────────────────────────────────────────

const instagram: Ferramenta = {
  nome: "instagram",
  titulo: "Instagram: conversas, automações e publicações",
  descricao:
    "Como está o Instagram: quantas conversas aguardam resposta, quais automações de DM estão ativas e quantas vezes dispararam, quando foi a última publicação e se a conta está conectada.",
  schema: vazio,
  somenteLeitura: true,
  async executar() {
    const m = await carregarMaquina();
    return secoes(
      `${titulo("Instagram")}\n` +
        [
          m.meta.instagramConectado ? "conta conectada" : "CONTA DESCONECTADA",
          `${m.totais.aguardandoResposta} aguardando resposta`,
          `${m.totais.conversasPeriodo} conversas em 30 dias`,
          `${m.totais.leadsPeriodo} leads em 30 dias`,
          m.meta.diasSemPublicar !== null ? `${plural(m.meta.diasSemPublicar, "dia")} sem publicar` : "nunca publicou",
        ].join(" · "),
      `${titulo("Automações")}\n${lista(
        m.automacoes.map(
          (a) => `${a.nome || "sem nome"} · ${a.ativa ? "ativa" : "pausada"} · ${plural(a.execucoes, "disparo")} · ${a.acao}${a.ultimaExecucao ? ` · última ${data(a.ultimaExecucao)}` : " · nunca disparou"}`
        ),
        "Nenhuma automação."
      )}`,
      `${titulo("Leads do Instagram ainda não tratados")}\n${lista(
        m.leadsNaoTratados.map((l) => `${l.nome} · id ${l.id}`),
        "Todos tratados."
      )}`
    );
  },
};

// ─── Catálogo ────────────────────────────────────────────────────────────────

export const FERRAMENTAS: Ferramenta[] = [
  hoje,
  maquinaStatus,
  postDetalhe,
  clientes,
  clienteDetalhe,
  financeiro,
  pipeline,
  instagram,
];

export function acharFerramenta(nome: string): Ferramenta | undefined {
  return FERRAMENTAS.find((f) => f.nome === nome);
}

/**
 * Descrição dos argumentos em uma forma simples e estável.
 *
 * O servidor MCP da sua máquina precisa montar um schema a partir disto sem
 * conhecer o código daqui — por isso o contrato é propositalmente pobre:
 * texto, numero, booleano e opcao. Nenhuma ferramenta precisa de mais.
 */
export interface Parametro {
  nome: string;
  tipo: "texto" | "numero" | "booleano" | "opcao";
  descricao: string;
  obrigatorio: boolean;
  opcoes?: string[];
  padrao?: unknown;
}

function parametros(schema: z.ZodObject<z.ZodRawShape>): Parametro[] {
  const js = z.toJSONSchema(schema, { io: "input" }) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  const obrigatorios = new Set(js.required ?? []);

  return Object.entries(js.properties ?? {}).map(([nome, p]) => {
    const opcoes = Array.isArray(p.enum) ? (p.enum as string[]) : undefined;
    const tipo: Parametro["tipo"] = opcoes
      ? "opcao"
      : p.type === "boolean"
        ? "booleano"
        : p.type === "number" || p.type === "integer"
          ? "numero"
          : "texto";
    return {
      nome,
      tipo,
      descricao: typeof p.description === "string" ? p.description : "",
      obrigatorio: obrigatorios.has(nome),
      ...(opcoes ? { opcoes } : {}),
      ...(p.default !== undefined ? { padrao: p.default } : {}),
    };
  });
}

/** Catálogo que o servidor MCP lê no boot para registrar as ferramentas. */
export function catalogo() {
  return FERRAMENTAS.map((f) => ({
    nome: f.nome,
    titulo: f.titulo,
    descricao: f.descricao,
    somenteLeitura: f.somenteLeitura,
    parametros: parametros(f.schema),
  }));
}
