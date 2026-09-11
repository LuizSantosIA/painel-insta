import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAgente, MODELO_FORTE } from "./ia";
import { systemBase } from "./voz";
import { OBJETIVOS, TIPOS_CONTEUDO } from "./etapas";
import {
  filtrarRepetidas,
  mediaScore,
  montarContextoMemoria,
  selecionarMelhores,
  type IdeiaCandidata,
} from "./memoria";

/**
 * Os agentes de texto. Cada um: schema de saída, papel, prompt montado a partir do
 * banco, e uma chamada a executarAgente — que é quem grava a trilha.
 *
 * Nenhum agente decide para onde o post vai; isso é o orquestrador (etapas.ts).
 */

// ─── Memória compartilhada ───────────────────────────────────────────────────

async function contextoMemoria(): Promise<string> {
  const [publicados, aprendizados] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLICADO" },
      orderBy: { postedAt: "desc" },
      take: 40,
      select: { id: true, tituloInterno: true, tema: true, caption: true, palavraChave: true, postedAt: true },
    }),
    prisma.aprendizado.findMany({ where: { ativo: true }, orderBy: { peso: "desc" }, take: 20 }),
  ]);
  return montarContextoMemoria(publicados, aprendizados);
}

// ─── RADAR (resumo de uma fonte lida) ────────────────────────────────────────

export const SaidaRadar = z.object({
  titulo: z.string(),
  autor: z.string().nullable(),
  plataforma: z.enum(["instagram", "x", "youtube", "blog", "newsletter", "github", "outro"]),
  tema: z.string(),
  formato: z.enum(["carrossel", "reels", "artigo", "thread", "video", "outro"]),
  sinais: z.object({
    likes: z.number().nullable(),
    comentarios: z.number().nullable(),
    compartilhamentos: z.number().nullable(),
    views: z.number().nullable(),
  }),
  resumo: z.string(),
  porQueFunciona: z.string(),
});

export async function radarResumirFonte(fonteId: string) {
  const fonte = await prisma.fonteConteudo.findUniqueOrThrow({ where: { id: fonteId } });
  const { saida } = await executarAgente({
    agente: "RADAR",
    etapa: "RADAR",
    entrada: { fonteId, url: fonte.url },
    system: systemBase(
      "Você é o RADAR: lê um conteúdo e descreve o que ele é e por que poderia funcionar para o Luiz. Não copia, não adapta — só observa. Só preencha 'sinais' com números que estejam explícitos no texto; do contrário, null."
    ),
    prompt: `URL: ${fonte.url}\n\nCONTEÚDO EXTRAÍDO:\n${(fonte.conteudoBruto ?? "").slice(0, 12_000)}`,
    schema: SaidaRadar,
  });

  await prisma.fonteConteudo.update({
    where: { id: fonteId },
    data: {
      titulo: saida.titulo,
      autor: saida.autor,
      plataforma: saida.plataforma,
      tema: saida.tema,
      formato: saida.formato,
      sinais: JSON.stringify(saida.sinais),
      resumo: saida.resumo,
      porQueFunciona: saida.porQueFunciona,
    },
  });
  return saida;
}

// ─── ESTRATEGISTA ────────────────────────────────────────────────────────────

const Score = z.object({
  viralidade: z.number().min(0).max(10),
  fit: z.number().min(0).max(10),
  producao: z.number().min(0).max(10),
  valor: z.number().min(0).max(10),
  conversao: z.number().min(0).max(10),
});

export const SaidaEstrategista = z.object({
  ideias: z.array(
    z.object({
      titulo: z.string(),
      tema: z.string(),
      angulo: z.string(),
      objetivo: z.enum(OBJETIVOS),
      tipo: z.enum(TIPOS_CONTEUDO),
      fonteId: z.string().nullable(),
      score: Score,
      justificativa: z.string(),
    })
  ),
  descartadas: z.array(z.object({ titulo: z.string(), motivo: z.string() })),
});

/**
 * Lê as fontes não descartadas dos últimos dias + a memória, gera ideias com
 * score, remove repetidas e cria até 3 posts SELECIONADA. Zero ideia boa = zero post.
 */
export async function estrategistaSelecionar(): Promise<{ criados: string[]; descartadas: number }> {
  const desde = new Date(Date.now() - 7 * 86_400_000);
  const [fontes, memoria, publicados] = await Promise.all([
    prisma.fonteConteudo.findMany({
      where: { descartada: false, criadoEm: { gte: desde }, resumo: { not: null } },
      orderBy: { criadoEm: "desc" },
      take: 25,
    }),
    contextoMemoria(),
    prisma.post.findMany({
      where: { status: "PUBLICADO" },
      select: { id: true, tituloInterno: true, tema: true, caption: true, palavraChave: true, postedAt: true },
      take: 80,
      orderBy: { postedAt: "desc" },
    }),
  ]);

  const listaFontes = fontes.length
    ? fontes
        .map(
          (f) =>
            `[fonteId=${f.id}] ${f.titulo ?? f.url}\n  autor: ${f.autor ?? "?"} · ${f.plataforma ?? "?"} · ${f.formato ?? "?"}\n  tema: ${f.tema ?? "?"}\n  resumo: ${f.resumo}\n  por que funciona: ${f.porQueFunciona}`
        )
        .join("\n\n")
    : "(nenhuma fonte nova esta semana — gere ideias ORIGINAIS e de AUTORIDADE a partir do perfil)";

  const { saida } = await executarAgente({
    agente: "ESTRATEGISTA",
    etapa: "IDEIA",
    modelo: MODELO_FORTE,
    entrada: { fontes: fontes.length },
    system: systemBase(
      `Você é o ESTRATEGISTA DE CONTEÚDO do Luiz. Recebe o que o Radar encontrou e a memória do que já foi publicado, e decide o que vale virar post hoje.
Gere de 3 a 8 ideias. Para cada uma: título interno, tema, ângulo (o que torna ESTA versão do Luiz, não uma cópia), objetivo (ALCANCE = hook forte e compartilhável; AUTORIDADE = tutorial/sistema/aplicação prática; CONVERSAO = IA para empresas, case, bastidor, lead magnet), tipo (VIRAL_ADAPTADO só se veio de uma fonte; ORIGINAL; AUTORIDADE; EMPRESA), e score de 0 a 10 em viralidade, fit com o Luiz, facilidade de produção, valor e conversão.
Seja duro na nota. 7 é bom. 9 é raro. Se nada merece 7, devolva a lista vazia e explique em 'descartadas'.
Nunca sugira o que já está na memória como publicado.`
    ),
    prompt: `MEMÓRIA:\n${memoria || "(vazia)"}\n\nFONTES DO RADAR:\n${listaFontes}`,
    schema: SaidaEstrategista,
  });

  // Anti-repetição determinística por cima do julgamento do modelo.
  const candidatas: (IdeiaCandidata & { angulo: string; tipo: string; fonteId: string | null })[] =
    saida.ideias.map((i, n) => ({
      id: `c${n}`,
      titulo: i.titulo,
      tema: i.tema,
      objetivo: i.objetivo,
      score: i.score,
      angulo: i.angulo,
      tipo: i.tipo,
      fonteId: i.fonteId,
    }));

  const { aceitas, descartadas } = filtrarRepetidas(candidatas, publicados);
  const escolhidas = selecionarMelhores(aceitas);

  const criados: string[] = [];
  for (const ideia of escolhidas) {
    const fonteValida = ideia.fonteId && fontes.some((f) => f.id === ideia.fonteId) ? ideia.fonteId : null;
    const post = await prisma.post.create({
      data: {
        caption: ideia.titulo,
        mediaType: "CAROUSEL_ALBUM",
        postedAt: new Date(),
        status: "RASCUNHO",
        etapa: "SELECIONADA",
        tituloInterno: ideia.titulo,
        tema: ideia.tema,
        objetivo: ideia.objetivo,
        tipoConteudo: fonteValida ? ideia.tipo : ideia.tipo === "VIRAL_ADAPTADO" ? "ORIGINAL" : ideia.tipo,
        fonteId: fonteValida,
        scoreEstrategia: JSON.stringify({ ...ideia.score, media: mediaScore(ideia.score), angulo: ideia.angulo }),
        source: "manual",
        geradoPelaMaquina: true,
      },
    });
    criados.push(post.id);
  }

  return { criados, descartadas: descartadas.length + saida.descartadas.length };
}

// ─── VIRAL ADAPTER ───────────────────────────────────────────────────────────

export const SaidaViralAdapter = z.object({
  hook: z.string(),
  promessa: z.string(),
  mecanismo: z.string(),
  estrutura: z.string(),
  quantidadeSlides: z.number().int(),
  narrativa: z.string(),
  visual: z.string(),
  cta: z.string(),
  adaptacao: z.object({
    hookBR: z.string(),
    oQuePreservar: z.string(),
    oQueMudar: z.string(),
    exemplosBR: z.array(z.string()),
  }),
});

export async function viralAdapterAnalisar(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId }, include: { fonte: true } });
  if (!post.fonte) return null;

  const { saida } = await executarAgente({
    agente: "VIRAL_ADAPTER",
    etapa: "SELECIONADA",
    postId,
    entrada: { fonteId: post.fonte.id },
    system: systemBase(
      `Você é o VIRAL ADAPTER. Disseca um conteúdo estrangeiro que performou e extrai o MECANISMO que o fez funcionar. Depois desenha a adaptação brasileira para o Luiz: preserva o mecanismo, troca linguagem, exemplos, contexto, CTA e posicionamento. Tradução literal é falha grave.`
    ),
    prompt: `FONTE: ${post.fonte.url}\nRESUMO DO RADAR: ${post.fonte.resumo}\n\nCONTEÚDO:\n${(post.fonte.conteudoBruto ?? "").slice(0, 12_000)}\n\nIDEIA APROVADA PELO ESTRATEGISTA: ${post.tituloInterno}\nÂNGULO: ${JSON.parse(post.scoreEstrategia ?? "{}").angulo ?? ""}`,
    schema: SaidaViralAdapter,
  });

  await prisma.fonteConteudo.update({ where: { id: post.fonte.id }, data: { analise: JSON.stringify(saida) } });
  return saida;
}

// ─── COPYWRITER ──────────────────────────────────────────────────────────────

export const SaidaCopywriter = z.object({
  slides: z
    .array(
      z.object({
        headline: z.string(),
        corpo: z.string(),
        microcopy: z.string(),
      })
    )
    .min(5)
    .max(9),
  legenda: z.string(),
  palavraChave: z.string().nullable(),
  materialPrometido: z.string().nullable(),
});

export async function copywriterEscrever(postId: string) {
  const [post, memoria] = await Promise.all([
    prisma.post.findUniqueOrThrow({ where: { id: postId }, include: { fonte: true, revisoes: { orderBy: { criadoEm: "desc" }, take: 3 } } }),
    contextoMemoria(),
  ]);

  const analise = post.fonte?.analise ? `\nANÁLISE DO VIRAL ADAPTER:\n${post.fonte.analise}` : "";
  const feedback = post.revisoes.filter((r) => r.decisao === "ALTERACAO").map((r) => `- [${r.escopo}] ${r.motivo}`).join("\n");
  const pedidoAlteracao = feedback ? `\nO LUIZ PEDIU ALTERAÇÃO — atenda exatamente:\n${feedback}` : "";

  const { saida } = await executarAgente({
    agente: "COPYWRITER",
    etapa: "SELECIONADA",
    postId,
    modelo: MODELO_FORTE,
    entrada: { titulo: post.tituloInterno, objetivo: post.objetivo, tipo: post.tipoConteudo },
    system: systemBase(
      `Você é o COPYWRITER do Luiz. Escreve o carrossel inteiro: hook, cada slide, legenda e — só se houver material real para entregar — a palavra-chave do CTA.
Se colocar palavraChave, descreva em materialPrometido o que a pessoa vai receber. Se não houver material, palavraChave = null e o CTA final é outro (salvar, compartilhar, seguir).
Legenda: 3 a 6 linhas curtas, sem hashtag no meio; pode terminar com até 5 hashtags relevantes.`
    ),
    prompt: `IDEIA: ${post.tituloInterno}\nTEMA: ${post.tema}\nOBJETIVO: ${post.objetivo}\nTIPO: ${post.tipoConteudo}\nÂNGULO: ${JSON.parse(post.scoreEstrategia ?? "{}").angulo ?? ""}${analise}\n\nMEMÓRIA:\n${memoria || "(vazia)"}${pedidoAlteracao}`,
    schema: SaidaCopywriter,
  });

  // Regrava os slides preservando imagem/versão de quem não mudou de texto.
  const existentes = await prisma.postSlide.findMany({ where: { postId } });
  await prisma.$transaction([
    prisma.postSlide.deleteMany({ where: { postId, ordem: { gt: saida.slides.length } } }),
    ...saida.slides.map((s, i) => {
      const ordem = i + 1;
      const antigo = existentes.find((e) => e.ordem === ordem);
      const mudou = !antigo || antigo.headline !== s.headline || antigo.corpo !== s.corpo || antigo.microcopy !== s.microcopy;
      return prisma.postSlide.upsert({
        where: { postId_ordem: { postId, ordem } },
        create: { postId, ordem, headline: s.headline, corpo: s.corpo, microcopy: s.microcopy },
        update: {
          headline: s.headline,
          corpo: s.corpo,
          microcopy: s.microcopy,
          // texto mudou → a imagem antiga não vale mais
          ...(mudou ? { imagemUrl: null, versao: { increment: 1 } } : {}),
        },
      });
    }),
    prisma.post.update({
      where: { id: postId },
      data: { legendaFinal: saida.legenda, palavraChave: saida.palavraChave?.toUpperCase() ?? null },
    }),
  ]);

  return saida;
}

// ─── DIRETOR VISUAL ──────────────────────────────────────────────────────────

export const SaidaDiretorVisual = z.object({
  estiloChave: z.string(),
  porQueEsteEstilo: z.string(),
  slides: z.array(
    z.object({
      ordem: z.number().int(),
      layout: z.enum(["HOOK", "TEXTO", "LISTA", "DESTAQUE", "CTA"]),
      promptVisual: z.string(),
    })
  ),
});

export async function diretorVisualDirigir(postId: string, apenasSlides?: number[]) {
  const [post, estilos] = await Promise.all([
    prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: { slides: { orderBy: { ordem: "asc" } }, estiloVisual: true, revisoes: { orderBy: { criadoEm: "desc" }, take: 3 } },
    }),
    prisma.estiloVisual.findMany({ where: { ativo: true } }),
  ]);

  const feedback = post.revisoes.filter((r) => r.decisao === "ALTERACAO" && /SLIDE|VISUAL/.test(r.escopo)).map((r) => `- [${r.escopo}] ${r.motivo}`).join("\n");

  const { saida } = await executarAgente({
    agente: "DIRETOR_VISUAL",
    etapa: "COPY",
    postId,
    entrada: { slides: post.slides.length, estiloAtual: post.estiloVisual?.chave ?? null, apenasSlides },
    system: systemBase(
      `Você é o DIRETOR VISUAL. Escolhe o sistema visual que melhor serve o conteúdo e dá a direção de arte de cada slide.
Layouts disponíveis: HOOK (headline gigante, nada mais), TEXTO (headline + corpo), LISTA (headline + itens), DESTAQUE (um número ou frase em evidência), CTA (chamada final).
promptVisual descreve composição, hierarquia e — se o estilo usa asset — o elemento ilustrativo. Consistência entre slides é obrigatória: mesma paleta, mesma tipografia, mesma linguagem.
${post.estiloVisual ? `O post JÁ tem estilo ${post.estiloVisual.chave}; mantenha-o a menos que o feedback peça troca.` : ""}`
    ),
    prompt: `SISTEMAS VISUAIS:\n${estilos.map((e) => `[${e.chave}] ${e.nome}: ${e.descricao}\n  paleta ${e.paleta} · ${e.tipografia}\n  regras: ${e.regras}${e.usaAsset ? " · USA ASSET GERADO" : ""}`).join("\n\n")}\n\nPOST: ${post.tituloInterno} (${post.objetivo}, ${post.tipoConteudo})\n\nSLIDES:\n${post.slides.map((s) => `${s.ordem}. ${s.headline} — ${s.corpo}${s.microcopy ? ` (${s.microcopy})` : ""}`).join("\n")}${feedback ? `\n\nFEEDBACK DO LUIZ:\n${feedback}` : ""}`,
    schema: SaidaDiretorVisual,
  });

  const estilo = estilos.find((e) => e.chave === saida.estiloChave) ?? estilos[0];
  await prisma.$transaction([
    prisma.post.update({ where: { id: postId }, data: { estiloVisualId: estilo.id } }),
    ...saida.slides
      .filter((s) => !apenasSlides || apenasSlides.includes(s.ordem))
      .map((s) =>
        prisma.postSlide.updateMany({
          where: { postId, ordem: s.ordem },
          data: { layout: s.layout, promptVisual: s.promptVisual, imagemUrl: null },
        })
      ),
  ]);

  return { ...saida, estilo };
}

// ─── FACT CHECKER ────────────────────────────────────────────────────────────

export const SaidaFactChecker = z.object({
  verificacoes: z.array(
    z.object({
      afirmacao: z.string(),
      status: z.enum(["VERIFICADO", "NAO_CONFIRMADO", "INCORRETO"]),
      nota: z.string(),
      slide: z.number().int().nullable(),
    })
  ),
  temAlerta: z.boolean(),
});

export async function factCheckerVerificar(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId }, include: { slides: { orderBy: { ordem: "asc" } } } });

  const { saida } = await executarAgente({
    agente: "FACT_CHECKER",
    etapa: "DESIGN",
    postId,
    entrada: { slides: post.slides.length },
    system: `Você é o FACT CHECKER. Liste TODA afirmação verificável do carrossel: nomes de ferramentas, skills, plugins, MCPs, funcionalidades, números, compatibilidades, links, estatísticas.
Para cada uma: VERIFICADO (você tem certeza), NAO_CONFIRMADO (plausível mas você não pode garantir) ou INCORRETO (está errado). Na dúvida, NAO_CONFIRMADO. Nunca invente para confirmar.
temAlerta = true se existir qualquer NAO_CONFIRMADO ou INCORRETO.`,
    prompt: `SLIDES:\n${post.slides.map((s) => `${s.ordem}. ${s.headline} — ${s.corpo}`).join("\n")}\n\nLEGENDA:\n${post.legendaFinal ?? ""}`,
    schema: SaidaFactChecker,
  });

  if (saida.temAlerta) {
    // Marca a execução como ALERTA para aparecer no checklist sem bloquear.
    await prisma.execucaoAgente.updateMany({
      where: { postId, agente: "FACT_CHECKER", status: "OK" },
      data: { status: "ALERTA" },
    });
  }
  return saida;
}

// ─── LEAD MAGNET ─────────────────────────────────────────────────────────────

export const SaidaLeadMagnet = z.object({
  propostaMaterial: z.string(),
  formatoSugerido: z.string(),
});

/**
 * Se há palavra-chave, garante uma AutoRule ligada ao post. Se a regra não tem
 * link de material, o status é "Material pendente" e o modelo propõe o conteúdo.
 * Nunca deixa CTA prometendo algo que não existe passar sem alerta.
 */
export async function leadMagnetPreparar(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId }, include: { autoRules: true } });
  if (!post.palavraChave) return { status: "SEM_CTA" as const, regraId: null, proposta: null };

  let regra =
    post.autoRules[0] ??
    (await prisma.autoRule.findFirst({
      where: { keywords: { contains: post.palavraChave }, postId: null, isActive: true },
    }));

  if (!regra) {
    regra = await prisma.autoRule.create({
      data: {
        name: `Lead magnet · ${post.tituloInterno ?? post.palavraChave}`,
        keywords: post.palavraChave,
        sendDm: true,
        dmText: "",
        gatilho: "AMBOS",
        exigirSeguir: true,
        linkLiberado: "",
        isActive: false, // só ativa quando o post publicar e existir material
        postId,
      },
    });
  } else if (!regra.postId) {
    regra = await prisma.autoRule.update({ where: { id: regra.id }, data: { postId } });
  }

  const temMaterial = /^https?:\/\//i.test(regra.linkLiberado);
  if (temMaterial) return { status: "PRONTO" as const, regraId: regra.id, proposta: null };

  const { saida } = await executarAgente({
    agente: "LEAD_MAGNET",
    etapa: "REVISAO",
    postId,
    entrada: { palavraChave: post.palavraChave },
    system: systemBase(
      "Você é o LEAD MAGNET. O post promete um material que ainda não existe. Proponha o conteúdo desse material: o que entrega, estrutura, formato (página, PDF, Notion, vídeo curto). Prático e entregável em um dia."
    ),
    prompt: `POST: ${post.tituloInterno}\nPALAVRA-CHAVE: ${post.palavraChave}\nLEGENDA: ${post.legendaFinal ?? ""}`,
    schema: SaidaLeadMagnet,
  });

  return { status: "PENDENTE" as const, regraId: regra.id, proposta: saida };
}

// ─── REVISOR FINAL ───────────────────────────────────────────────────────────

export const SaidaRevisor = z.object({
  scoreFinal: z.number().int().min(0).max(100),
  checklist: z.object({
    copy: z.boolean(),
    design: z.boolean(),
    factCheck: z.boolean(),
    leadMagnet: z.boolean(),
    legenda: z.boolean(),
  }),
  problemas: z.array(z.object({ onde: z.string(), oQue: z.string(), gravidade: z.enum(["BAIXA", "MEDIA", "ALTA"]) })),
  resumoParaOLuiz: z.string(),
});

export async function revisorAvaliar(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: {
      slides: { orderBy: { ordem: "asc" } },
      estiloVisual: true,
      execucoes: { where: { agente: { in: ["FACT_CHECKER", "LEAD_MAGNET"] } }, orderBy: { criadoEm: "desc" }, take: 2 },
    },
  });

  const factCheck = post.execucoes.find((e) => e.agente === "FACT_CHECKER");
  const leadMagnet = post.execucoes.find((e) => e.agente === "LEAD_MAGNET");

  const { saida } = await executarAgente({
    agente: "REVISOR",
    etapa: "REVISAO",
    postId,
    entrada: { slides: post.slides.length, semImagem: post.slides.filter((s) => !s.imagemUrl).length },
    system: systemBase(
      `Você é o REVISOR FINAL. Última barreira antes do Luiz. Verifique português, texto cortado (headline > 8 palavras ou corpo > 30 estoura o slide), consistência, identidade, CTA, repetição, e os alertas do fact checker.
scoreFinal de 0 a 100. Abaixo de 70 o post não deveria ir para aprovação. Seja específico em 'problemas'. resumoParaOLuiz: 2 linhas, o que ele precisa saber antes de olhar.`
    ),
    prompt: `POST: ${post.tituloInterno} · ${post.objetivo} · ${post.tipoConteudo} · estilo ${post.estiloVisual?.chave ?? "?"}\n\nSLIDES:\n${post.slides.map((s) => `${s.ordem}. [${s.layout}] ${s.headline} — ${s.corpo}${s.microcopy ? ` (${s.microcopy})` : ""}${s.imagemUrl ? "" : " [SEM IMAGEM]"}`).join("\n")}\n\nLEGENDA:\n${post.legendaFinal ?? "(vazia)"}\nCTA: ${post.palavraChave ?? "sem palavra-chave"}\n\nFACT CHECK: ${factCheck?.saida ?? "(não rodou)"}\nLEAD MAGNET: ${leadMagnet ? leadMagnet.status : "(sem CTA)"}`,
    schema: SaidaRevisor,
  });

  await prisma.post.update({ where: { id: postId }, data: { scoreFinal: saida.scoreFinal } });
  return saida;
}
