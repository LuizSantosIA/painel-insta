import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Busca notícias reais de IA via RSS (sem API key) ──────────────────────────

const RSS_FEEDS = [
  "https://venturebeat.com/category/ai/feed/",
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://www.artificialintelligence-news.com/feed/",
];

interface NewsItem {
  title: string;
  description: string;
  link: string;
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = new RegExp(`<${tag}><!\[CDATA\[(.*?)\]\]><\/${tag}>`, "s").exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "s").exec(xml);
  return plainMatch ? plainMatch[1].replace(/<[^>]+>/g, "").trim() : "";
}

function parseRSSItems(xml: string, max = 5): NewsItem[] {
  const items: NewsItem[] = [];
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const block of itemBlocks.slice(0, max)) {
    const content = block[1];
    const title = extractTag(content, "title");
    const description = extractTag(content, "description");
    const link = extractTag(content, "link");
    if (title) items.push({ title, description: description.slice(0, 200), link });
  }
  return items;
}

async function fetchAINews(): Promise<NewsItem[]> {
  const all: NewsItem[] = [];
  await Promise.allSettled(
    RSS_FEEDS.map(async (url) => {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS reader)" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        all.push(...parseRSSItems(xml, 4));
      } catch { /* ignora feeds que falharem */ }
    })
  );
  // Deduplica por título e retorna as 8 mais recentes
  const seen = new Set<string>();
  return all.filter(n => {
    const key = n.title.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

// ── Busca imagem no Pexels ────────────────────────────────────────────────────

async function fetchPexelsImage(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=square`,
      { headers: { Authorization: key }, cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { photos?: { src: { large: string; medium: string } }[] };
    const photos = data.photos ?? [];
    if (photos.length === 0) return null;
    const pick = photos[Math.floor(Math.random() * Math.min(photos.length, 5))];
    return pick.src.large ?? pick.src.medium;
  } catch {
    return null;
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(news: NewsItem[]): string {
  const newsBlock = news.length > 0
    ? `NOTÍCIAS REAIS DE IA DESTA SEMANA (use como base para o carrossel):
${news.map((n, i) => `${i + 1}. ${n.title}\n   ${n.description}`).join("\n\n")}`
    : "Sem notícias disponíveis — use conhecimento atual sobre IA nos negócios.";

  return `Você é um criador de conteúdo especialista em IA para empresas, com estilo jornalístico e direto.
Seu público são empresários e gestores brasileiros que precisam entender o que a IA significa para SEUS negócios.

${newsBlock}

MISSÃO: Crie um carrossel de 5 slides baseado em UMA das notícias acima (ou no tema se não houver).
O carrossel deve explicar o que a notícia significa na prática para empresas brasileiras.

ESTRUTURA OBRIGATÓRIA:
- Slide 1 (CAPA): Manchete chocante. Fato real com número ou nome de empresa. Máx 10 palavras no título. Subtexto: 3-4 frases que contextualizam o fato e por que o empresário deve parar para ler.
- Slide 2 (CONTEXTO): Explique o que está acontecendo com profundidade. Use dados do artigo — números, empresas citadas, datas. 4-5 frases densas. O leitor deve sair deste slide sabendo exatamente o que está acontecendo no mundo.
- Slide 3 (IMPACTO): Como isso impacta empresas BRASILEIRAS de pequeno e médio porte? Seja específico: quais setores, quais processos, quais cargos. 4-5 frases com exemplos concretos ("Uma empresa de RH com 50 funcionários pode...").
- Slide 4 (AÇÃO): 3-5 ações específicas e acionáveis que o empresário pode fazer AGORA. Liste com bullet points: "• Experimente X", "• Avalie se Y", "• Pergunte ao fornecedor Z". Inclua ferramenta ou recurso específico quando possível.
- Slide 5 (CTA): Pergunta direta e provocativa que gera comentário ou reflexão. Pode ser polêmica. Termina com incentivo para salvar o carrossel ou seguir o perfil.

ESTILO: @castilho.ia, @alanvalletta — linguagem direta, zero enrolação, parece que foi escrito por quem sabe do que fala.
PROIBIDO: frases genéricas como "a IA está transformando o mundo", "as empresas precisam se adaptar", "o futuro é agora". Seja ESPECÍFICO.

Responda APENAS com JSON (sem markdown, sem texto extra):
{
  "topico": "Título da notícia adaptado (máx 7 palavras)",
  "slides": [
    {
      "titulo": "Manchete com fato real e número (máx 10 palavras)",
      "corpo": "3-4 frases contextualizando — por que isso importa para o empresário brasileiro agora.",
      "imageQuery": "2-4 specific English keywords for visual Pexels image — e.g. 'artificial intelligence robot factory' or 'CEO meeting technology'"
    },
    {
      "titulo": "O que está acontecendo de verdade (máx 8 palavras)",
      "corpo": "4-5 frases com dados, empresas citadas, números concretos do artigo. Seja jornalístico.",
      "imageQuery": "specific English keywords for context image — e.g. 'data center servers nvidia' or 'ai startup funding'"
    },
    {
      "titulo": "O que muda para sua empresa (máx 8 palavras)",
      "corpo": "4-5 frases com exemplos concretos para PMEs brasileiras. Setores específicos. Processos específicos.",
      "imageQuery": "specific English keywords — e.g. 'small business owner laptop automation' or 'team productivity office'"
    },
    {
      "titulo": "O que fazer agora (máx 6 palavras)",
      "corpo": "• Ação 1 específica com ferramenta\n• Ação 2 específica\n• Ação 3 específica\n• Recurso ou link relevante se aplicável",
      "imageQuery": "specific English keywords — e.g. 'entrepreneur planning strategy whiteboard' or 'business growth chart laptop'"
    },
    {
      "titulo": "Pergunta provocativa para o empresário (máx 8 palavras)",
      "corpo": "2-3 frases que provocam reflexão genuína. Pode ser polêmica. Termina com CTA para salvar ou comentar.",
      "imageQuery": "specific English keywords — e.g. 'businessman thinking future technology' or 'innovation disruption business'"
    }
  ],
  "legenda": "Legenda para Instagram com 300-400 palavras: abre com a manchete do fato real (primeira frase impactante). Desenvolve os pontos principais em parágrafos curtos. Tom de consultor que explica para o cliente. Emojis estratégicos (máx 5). Termina com pergunta para gerar comentário. Espaço em branco antes dos hashtags. 20 hashtags misturando populares e de nicho: #iaparaempresas #inteligenciaartificial #negocios #empreendedorismo #automacao #gestao #transformacaodigital #iabusiness #tecnologia #startups #ia #artificialintelligence #pme #gpt #inovacao #futurodonegocio #marketingdigital #produtividade #lideranca #crescimento"
}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

interface RawSlide {
  titulo: string;
  corpo: string;
  imageQuery?: string;
}

interface ParsedContent {
  topico: string;
  slides: RawSlide[];
  legenda: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
  }

  let topicoManual: string | undefined;
  try {
    const body = await req.json();
    topicoManual = typeof body.topico === "string" && body.topico.trim()
      ? body.topico.trim()
      : undefined;
  } catch { /* body vazio é ok */ }

  // Busca notícias reais em paralelo com a chamada da OpenAI
  const [news] = await Promise.all([fetchAINews()]);

  const systemPrompt = buildSystemPrompt(news);

  const userPrompt = topicoManual
    ? `Crie o carrossel sobre este tema específico: "${topicoManual}". Use as notícias acima como contexto se houver relação, ou gere conteúdo relevante sobre esse tema com dados reais.`
    : "Escolha a notícia mais impactante para empresários brasileiros e crie o carrossel.";

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? "Erro na OpenAI";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const data = await openaiRes.json();
  let parsed: ParsedContent;
  try {
    parsed = JSON.parse(data.choices[0].message.content) as ParsedContent;
    if (!parsed.topico || !Array.isArray(parsed.slides) || parsed.slides.length === 0 || !parsed.legenda) {
      throw new Error("formato inválido");
    }
  } catch {
    return NextResponse.json({ error: "Resposta inválida da IA. Tente novamente." }, { status: 500 });
  }

  // Busca imagens em paralelo para cada slide
  const slidesWithImages = await Promise.all(
    parsed.slides.map(async (slide) => ({
      ...slide,
      imageUrl: await fetchPexelsImage(slide.imageQuery ?? parsed.topico),
    }))
  );

  const rascunho = await prisma.postRascunho.create({
    data: {
      topico: parsed.topico,
      slides: JSON.stringify(slidesWithImages),
      legenda: parsed.legenda,
      status: "RASCUNHO",
      atualizadoEm: new Date(),
    },
  });

  return NextResponse.json(rascunho, { status: 201 });
}
