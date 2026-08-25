import "server-only";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/instagram";
import { engagement, engagementRate, type PostLike } from "@/lib/metrics";
import {
  atribuicaoVazia,
  classificarConversa,
  diasDesde,
  ehOportunidade,
  type AtribuicaoConteudo,
  type StatusConversa,
} from "@/lib/maquina";

/**
 * Camada de dados da Máquina.
 *
 * Existe um lugar só onde a cadeia CONTEÚDO → CONVERSA → LEAD → OPORTUNIDADE →
 * CLIENTE → RECEITA é montada, e é aqui. As rotas de /api/maquina/* apenas
 * recortam o que precisam deste carregamento — nenhuma delas refaz a atribuição
 * por conta própria, senão duas telas passariam a discordar sobre o mesmo post.
 *
 * ─── Como a atribuição é feita ─────────────────────────────────────────────
 *
 *  1. CommentLog.igPostId = Post.igId
 *     Todo comentário que disparou automação já registra em qual post aconteceu.
 *     É daqui que sai "quantas conversas este conteúdo iniciou".
 *
 *  2. CommentLog.senderId = IgConversation.igUserId
 *     O IGSID de quem comentou é o mesmo id do participante da conversa no
 *     direct. É o elo que liga um post a uma conversa real.
 *
 *  3. Lead.postOrigemId (explícito) ou Lead.conversaId → conversa → pessoa → post
 *     O lead guarda o post quando ele é conhecido; quando não, chegamos nele pela
 *     conversa de origem.
 *
 *  4. Lead.clienteId → Receita.clienteId
 *     Receita continua sendo do Financeiro. A Máquina só aponta de onde veio.
 *
 * REGRA DE PRIMEIRO TOQUE: uma pessoa que comentou em vários posts é atribuída ao
 * post do comentário mais antigo, e um cliente é atribuído a um único conteúdo.
 * Sem isso a mesma receita apareceria somada em dois lugares.
 *
 * Só entra como receita atribuída o que está com status RECEBIDA — dinheiro que
 * de fato entrou. Previsto e confirmado são do Financeiro, não da Máquina.
 */

// ─── Formatos de saída ───────────────────────────────────────────────────────

export interface ConteudoMaquina {
  id: string;
  igId: string | null;
  caption: string | null;
  mediaType: string;
  category: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  status: string;
  postedAt: string;
  agendadoPara: string | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  videoViews: number;
  interacoes: number;
  taxaEngajamento: number;
  alcance: number;
  atribuicao: AtribuicaoConteudo;
}

export interface ConversaMaquina {
  id: string;
  igUserId: string;
  igUsername: string;
  updatedAt: string;
  syncedAt: string;
  /** Última mensagem da thread — o suficiente para a lista, sem carregar tudo. */
  ultimaMensagem: { texto: string; fromMe: boolean; createdAt: string } | null;
  totalMensagens: number;
  status: StatusConversa;
  /** Post que originou a conversa, quando a pessoa veio de um comentário. */
  postOrigem: { id: string; igId: string; caption: string | null } | null;
  /** Automação que puxou a pessoa para o direct, quando conhecida. */
  automacaoOrigem: { id: string; nome: string } | null;
  lead: { id: string; nome: string; estagio: string } | null;
}

export interface AutomacaoMaquina {
  id: string;
  nome: string;
  keywords: string;
  gatilho: string;
  ativa: boolean;
  exigirSeguir: boolean;
  criaLead: boolean;
  leadLinha: string | null;
  mediaId: string | null;
  postAlvo: { id: string; caption: string | null } | null;
  /** Resumo em uma linha do que a regra faz. */
  acao: string;
  execucoes: number;
  comentarios: number;
  dmsEnviadas: number;
  conversas: number;
  leads: number;
  oportunidades: number;
  receitaCentavos: number;
  ultimaExecucao: string | null;
}

export interface TotaisMaquina {
  /** Conteúdos publicados no recorte de período. */
  publicadosPeriodo: number;
  publicadosTotal: number;
  /** Pessoas distintas com quem a Máquina trocou direct. */
  conversasPeriodo: number;
  conversasTotal: number;
  leadsPeriodo: number;
  leadsTotal: number;
  oportunidadesTotal: number;
  clientesTotal: number;
  /** null = nenhuma receita pôde ser ligada a um conteúdo. */
  receitaAtribuidaCentavos: number | null;
  alcanceTotal: number;
  interacoesTotal: number;
  aguardandoResposta: number;
}

export interface MetaMaquina {
  instagramConectado: boolean;
  facebookPageConectada: boolean;
  ultimaPublicacao: string | null;
  ultimaSincronizacaoConversas: string | null;
  diasSemPublicar: number | null;
  diasSemSincronizar: number | null;
  automacoesAtivas: number;
  automacoesSemExecucao: number;
}

export interface DadosMaquina {
  conteudos: ConteudoMaquina[];
  conversas: ConversaMaquina[];
  automacoes: AutomacaoMaquina[];
  totais: TotaisMaquina;
  meta: MetaMaquina;
  /** Leads de origem Instagram ainda no primeiro estágio do pipeline. */
  leadsNaoTratados: { id: string; nome: string }[];
  /** Conteúdos com data no passado e status ainda AGENDADO. */
  agendadosVencidos: { id: string; titulo: string; dias: number }[];
}

/** Janela padrão dos indicadores de período. */
export const JANELA_DIAS = 30;

const ORIGENS_INSTAGRAM = ["INSTAGRAM_DM", "INSTAGRAM_COMENTARIO"];

/** PostLike mínimo para reaproveitar os cálculos de metrics.ts. */
function paraPostLike(p: {
  id: string;
  igId: string | null;
  caption: string | null;
  mediaType: string;
  category: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  postedAt: Date;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  videoViews: number;
  followersAtPost: number;
}): PostLike {
  return p;
}

/**
 * Carrega e cruza tudo que a Máquina precisa, num número fixo de queries —
 * nunca uma por post, conversa ou regra.
 */
export async function carregarMaquina(agora = new Date()): Promise<DadosMaquina> {
  const desde = new Date(agora.getTime() - JANELA_DIAS * 86_400_000);

  const [posts, comentarios, conversasRaw, mensagensTotais, mensagensMinhas, leads, regras] =
    await Promise.all([
      prisma.post.findMany({ orderBy: { postedAt: "desc" } }),
      prisma.commentLog.findMany({
        // Só as colunas que a atribuição usa: o histórico de comentários é a maior
        // tabela da Máquina e trafega inteira a cada carregamento.
        select: {
          igPostId: true,
          senderId: true,
          dmSentAt: true,
          ruleId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.igConversation.findMany({
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      prisma.igMessage.groupBy({ by: ["conversationId"], _count: { _all: true } }),
      prisma.igMessage.groupBy({
        by: ["conversationId"],
        where: { fromMe: true },
        _count: { _all: true },
      }),
      prisma.lead.findMany({
        select: {
          id: true,
          nome: true,
          contato: true,
          estagio: true,
          origem: true,
          postOrigemId: true,
          conversaId: true,
          automacaoId: true,
          clienteId: true,
          proximaAcaoEm: true,
          criadoEm: true,
        },
        orderBy: { criadoEm: "asc" },
      }),
      prisma.autoRule.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  // Receitas só dos clientes que estão no fim de alguma cadeia — nunca a tabela toda.
  const clienteIds = [...new Set(leads.map((l) => l.clienteId).filter((v): v is string => !!v))];
  const receitas = clienteIds.length
    ? await prisma.receita.findMany({
        where: { clienteId: { in: clienteIds }, status: "RECEBIDA" },
        select: { clienteId: true, valorCentavos: true },
      })
    : [];

  const receitaPorCliente = new Map<string, number>();
  for (const r of receitas) {
    if (!r.clienteId) continue;
    receitaPorCliente.set(r.clienteId, (receitaPorCliente.get(r.clienteId) ?? 0) + r.valorCentavos);
  }

  // ── Elo 1 e 2: comentário → post, pessoa → post de primeiro toque ──────────
  const atribuicaoPorIgId = new Map<string, AtribuicaoConteudo>();
  const postDaPessoa = new Map<string, string>(); // senderId → igPostId (primeiro toque)
  const regraDaPessoa = new Map<string, string>(); // senderId → ruleId (primeiro toque)
  const comentariosPorRegra = new Map<string, { total: number; dms: number; ultima: Date | null }>();
  const pessoasPorRegra = new Map<string, Set<string>>();

  function atribuicaoDe(igPostId: string): AtribuicaoConteudo {
    let a = atribuicaoPorIgId.get(igPostId);
    if (!a) {
      a = atribuicaoVazia();
      atribuicaoPorIgId.set(igPostId, a);
    }
    return a;
  }

  for (const c of comentarios) {
    if (c.igPostId) {
      const a = atribuicaoDe(c.igPostId);
      a.automacoes += 1;
      if (c.dmSentAt) a.dmsEnviadas += 1;
      // A lista vem ordenada por createdAt asc: o primeiro que grava é o mais antigo.
      if (c.senderId && !postDaPessoa.has(c.senderId)) postDaPessoa.set(c.senderId, c.igPostId);
    }
    if (c.ruleId) {
      const r = comentariosPorRegra.get(c.ruleId) ?? { total: 0, dms: 0, ultima: null };
      r.total += 1;
      if (c.dmSentAt) r.dms += 1;
      if (!r.ultima || c.createdAt > r.ultima) r.ultima = c.createdAt;
      comentariosPorRegra.set(c.ruleId, r);
      if (c.senderId) {
        if (!regraDaPessoa.has(c.senderId)) regraDaPessoa.set(c.senderId, c.ruleId);
        const set = pessoasPorRegra.get(c.ruleId) ?? new Set<string>();
        set.add(c.senderId);
        pessoasPorRegra.set(c.ruleId, set);
      }
    }
  }

  // ── Conversas ─────────────────────────────────────────────────────────────
  const totalPorConversa = new Map(mensagensTotais.map((m) => [m.conversationId, m._count._all]));
  const minhasPorConversa = new Map(mensagensMinhas.map((m) => [m.conversationId, m._count._all]));

  const postPorIgId = new Map(posts.filter((p) => p.igId).map((p) => [p.igId as string, p]));
  const regraPorId = new Map(regras.map((r) => [r.id, r]));

  const leadPorConversa = new Map<string, (typeof leads)[number]>();
  const leadPorContato = new Map<string, (typeof leads)[number]>();
  for (const l of leads) {
    if (l.conversaId) leadPorConversa.set(l.conversaId, l);
    if (l.contato) leadPorContato.set(l.contato.toLowerCase(), l);
  }

  const conversas: ConversaMaquina[] = conversasRaw.map((c) => {
    const ultima = c.messages[0] ?? null;
    const minhas = minhasPorConversa.get(c.id) ?? 0;
    const lead =
      leadPorConversa.get(c.id) ??
      (c.igUsername ? leadPorContato.get(`@${c.igUsername}`.toLowerCase()) : undefined) ??
      null;

    const igPostId = postDaPessoa.get(c.igUserId) ?? null;
    const post = igPostId ? postPorIgId.get(igPostId) : undefined;
    const ruleId = regraDaPessoa.get(c.igUserId) ?? null;
    const regra = ruleId ? regraPorId.get(ruleId) : undefined;

    return {
      id: c.id,
      igUserId: c.igUserId,
      igUsername: c.igUsername,
      updatedAt: c.updatedAt.toISOString(),
      syncedAt: c.syncedAt.toISOString(),
      ultimaMensagem: ultima
        ? { texto: ultima.text, fromMe: ultima.fromMe, createdAt: ultima.createdAt.toISOString() }
        : null,
      totalMensagens: totalPorConversa.get(c.id) ?? 0,
      status: classificarConversa({
        estagioLead: lead?.estagio ?? null,
        ultimaMinha: ultima ? ultima.fromMe : null,
        minhas,
      }),
      postOrigem: post ? { id: post.id, igId: post.igId as string, caption: post.caption } : null,
      automacaoOrigem: regra ? { id: regra.id, nome: regra.name || regra.keywords } : null,
      lead: lead ? { id: lead.id, nome: lead.nome, estagio: lead.estagio } : null,
    };
  });

  const conversaPorId = new Map(conversas.map((c) => [c.id, c]));

  // Conversas contam para o conteúdo de origem da pessoa.
  for (const c of conversas) {
    if (c.postOrigem) atribuicaoDe(c.postOrigem.igId).conversas += 1;
  }

  // ── Elo 3 e 4: lead → conteúdo, cliente → receita ─────────────────────────
  const clienteJaAtribuido = new Set<string>();
  const leadsPorRegra = new Map<string, { leads: number; oportunidades: number; receita: number }>();
  let receitaAtribuidaTotal = 0;
  let algumaCadeiaCompleta = false;

  for (const lead of leads) {
    const conversa = lead.conversaId ? conversaPorId.get(lead.conversaId) : undefined;
    const igPostId =
      lead.postOrigemId ??
      conversa?.postOrigem?.igId ??
      (conversa ? (postDaPessoa.get(conversa.igUserId) ?? null) : null);

    const ruleId = lead.automacaoId ?? (conversa ? regraDaPessoa.get(conversa.igUserId) : null);

    // Receita do cliente entra uma vez só, na primeira cadeia que chegar nele.
    let receitaDoLead = 0;
    if (lead.clienteId && !clienteJaAtribuido.has(lead.clienteId)) {
      clienteJaAtribuido.add(lead.clienteId);
      receitaDoLead = receitaPorCliente.get(lead.clienteId) ?? 0;
    }

    if (igPostId) {
      const a = atribuicaoDe(igPostId);
      a.leads += 1;
      if (ehOportunidade(lead.estagio)) a.oportunidades += 1;
      if (lead.clienteId) a.clientes += 1;
      a.receitaCentavos += receitaDoLead;
      if (receitaDoLead > 0) algumaCadeiaCompleta = true;
    }

    if (receitaDoLead > 0) receitaAtribuidaTotal += receitaDoLead;

    if (ruleId) {
      const r = leadsPorRegra.get(ruleId) ?? { leads: 0, oportunidades: 0, receita: 0 };
      r.leads += 1;
      if (ehOportunidade(lead.estagio)) r.oportunidades += 1;
      r.receita += receitaDoLead;
      leadsPorRegra.set(ruleId, r);
    }
  }

  // ── Conteúdos ─────────────────────────────────────────────────────────────
  const conteudos: ConteudoMaquina[] = posts.map((p) => {
    const like = paraPostLike(p);
    return {
      id: p.id,
      igId: p.igId,
      caption: p.caption,
      mediaType: p.mediaType,
      category: p.category,
      permalink: p.permalink,
      thumbnailUrl: p.thumbnailUrl,
      status: p.status,
      postedAt: p.postedAt.toISOString(),
      agendadoPara: p.agendadoPara?.toISOString() ?? null,
      likes: p.likes,
      comments: p.comments,
      saves: p.saves,
      shares: p.shares,
      reach: p.reach,
      impressions: p.impressions,
      videoViews: p.videoViews,
      interacoes: engagement(like),
      taxaEngajamento: engagementRate(like),
      alcance: p.reach,
      atribuicao: (p.igId ? atribuicaoPorIgId.get(p.igId) : undefined) ?? atribuicaoVazia(),
    };
  });

  const publicados = conteudos.filter((c) => c.status === "PUBLICADO");

  // ── Automações ────────────────────────────────────────────────────────────
  const conversasPorPessoa = new Set(conversas.map((c) => c.igUserId));

  const automacoes: AutomacaoMaquina[] = regras.map((r) => {
    const logs = comentariosPorRegra.get(r.id) ?? { total: 0, dms: 0, ultima: null };
    const pessoas = pessoasPorRegra.get(r.id) ?? new Set<string>();
    const conversasDaRegra = [...pessoas].filter((p) => conversasPorPessoa.has(p)).length;
    const resultado = leadsPorRegra.get(r.id) ?? { leads: 0, oportunidades: 0, receita: 0 };
    const post = r.mediaId ? postPorIgId.get(r.mediaId) : undefined;

    const acoes: string[] = [];
    if (r.replyText.trim()) acoes.push("Responder comentário");
    if (r.exigirSeguir) acoes.push("Pedir follow e liberar link");
    else if (r.sendDm && r.dmText.trim()) acoes.push("Enviar DM");
    if (r.createLead) acoes.push("Criar lead no pipeline");

    return {
      id: r.id,
      nome: r.name || r.keywords,
      keywords: r.keywords,
      gatilho: r.gatilho,
      ativa: r.isActive,
      exigirSeguir: r.exigirSeguir,
      criaLead: r.createLead,
      leadLinha: r.leadLinha,
      mediaId: r.mediaId,
      postAlvo: post ? { id: post.id, caption: post.caption } : null,
      acao: acoes.join(" · ") || "Sem ação configurada",
      execucoes: Math.max(r.triggerCount, logs.total),
      comentarios: logs.total,
      dmsEnviadas: logs.dms,
      conversas: conversasDaRegra,
      leads: resultado.leads,
      oportunidades: resultado.oportunidades,
      receitaCentavos: resultado.receita,
      ultimaExecucao: logs.ultima?.toISOString() ?? null,
    };
  });

  // ── Totais ────────────────────────────────────────────────────────────────
  const desdeMs = desde.getTime();

  // Uma pessoa é uma conversa: quem recebeu DM da automação e quem está no direct.
  const pessoasComConversa = new Set<string>([
    ...conversas.map((c) => c.igUserId),
    ...comentarios.filter((c) => c.dmSentAt && c.senderId).map((c) => c.senderId),
  ]);
  const pessoasNoPeriodo = new Set<string>([
    ...conversas.filter((c) => new Date(c.updatedAt).getTime() >= desdeMs).map((c) => c.igUserId),
    ...comentarios
      .filter((c) => c.dmSentAt && c.senderId && c.createdAt.getTime() >= desdeMs)
      .map((c) => c.senderId),
  ]);

  const leadsMaquina = leads.filter(
    (l) => ORIGENS_INSTAGRAM.includes(l.origem) || l.postOrigemId || l.conversaId
  );

  const ultimaPublicacao = publicados[0]?.postedAt ?? null;
  const ultimaSync = conversasRaw.reduce<Date | null>(
    (maior, c) => (!maior || c.syncedAt > maior ? c.syncedAt : maior),
    null
  );

  const aguardando = conversas.filter(
    (c) => c.status === "NOVA" || c.status === "AGUARDANDO_VOCE"
  ).length;

  const totais: TotaisMaquina = {
    publicadosPeriodo: publicados.filter((c) => new Date(c.postedAt).getTime() >= desdeMs).length,
    publicadosTotal: publicados.length,
    conversasPeriodo: pessoasNoPeriodo.size,
    conversasTotal: pessoasComConversa.size,
    leadsPeriodo: leadsMaquina.filter((l) => l.criadoEm.getTime() >= desdeMs).length,
    leadsTotal: leadsMaquina.length,
    oportunidadesTotal: leadsMaquina.filter((l) => ehOportunidade(l.estagio)).length,
    clientesTotal: new Set(
      leadsMaquina.filter((l) => l.clienteId).map((l) => l.clienteId as string)
    ).size,
    receitaAtribuidaCentavos: algumaCadeiaCompleta ? receitaAtribuidaTotal : null,
    alcanceTotal: publicados.reduce((s, c) => s + c.reach, 0),
    interacoesTotal: publicados.reduce((s, c) => s + c.interacoes, 0),
    aguardandoResposta: aguardando,
  };

  const meta: MetaMaquina = {
    instagramConectado: isConfigured(),
    facebookPageConectada: Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN),
    ultimaPublicacao,
    ultimaSincronizacaoConversas: ultimaSync?.toISOString() ?? null,
    diasSemPublicar: ultimaPublicacao ? Math.max(0, diasDesde(ultimaPublicacao, agora)) : null,
    diasSemSincronizar: ultimaSync ? Math.max(0, diasDesde(ultimaSync, agora)) : null,
    automacoesAtivas: automacoes.filter((a) => a.ativa).length,
    automacoesSemExecucao: automacoes.filter((a) => a.ativa && a.execucoes === 0).length,
  };

  return {
    conteudos,
    conversas,
    automacoes,
    totais,
    meta,
    leadsNaoTratados: leadsMaquina
      .filter((l) => l.estagio === "LEAD")
      .map((l) => ({ id: l.id, nome: l.nome })),
    agendadosVencidos: conteudos
      .filter((c) => c.status === "AGENDADO" && c.agendadoPara && new Date(c.agendadoPara) < agora)
      .map((c) => ({
        id: c.id,
        titulo: c.caption?.slice(0, 60) || "Conteúdo sem legenda",
        dias: Math.max(1, diasDesde(c.agendadoPara as string, agora)),
      })),
  };
}
