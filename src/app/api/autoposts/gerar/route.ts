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
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square&size=medium`,
      { headers: { Authorization: key }, cache: "no-store", signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { photos?: { src: { medium: string } }[] };
    const photos = data.photos ?? [];
    if (photos.length === 0) return null;
    const pick = photos[Math.floor(Math.random() * photos.length)];
    return pick.src.medium;
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
- Slide 1 (CAPA): Manchete adaptada — fato real + impacto no empresário. Curta, impactante, sem rodeios.
- Slide 2 (CONTEXTO): O que está acontecendo de verdade? Explique o cenário com dados do artigo.
- Slide 3 (IMPACTO): O que isso muda para empresas? Seja específico — setor, tamanho, processo.
- Slide 4 (AÇÃO): O que o empresário deve fazer AGORA? Passo concreto e acionável.
- Slide 5 (CTA): Pergunta que provoca reflexão ou gera comentário.

TOME COMO REFERÊNCIA o estilo @castilho.ia: frases curtas, fatos reais, zero enrolação, tom de consultor que entende do assunto.

Responda APENAS com JSON (sem markdown, sem texto extra):
{
  "topico": "Título da notícia adaptado (máx 7 palavras)",
  "slides": [
    {
      "titulo": "Manchete impactante — fato real (máx 9 palavras)",
      "corpo": "2-3 frases curtas e diretas. Use dados reais se disponível.",
      "imageQuery": "2-4 palavras em inglês para buscar imagem no Pexels — seja visual e específico"
    },
    {
      "titulo": "O que está acontecendo (máx 7 palavras)",
      "corpo": "Contexto real com dado ou número concreto da notícia.",
      "imageQuery": "keywords in English for context image"
    },
    {
      "titulo": "O que muda para sua empresa (máx 7 palavras)",
      "corpo": "Impacto prático e específico para empresas brasileiras.",
      "imageQuery": "keywords in English for business impact image"
    },
    {
      "titulo": "O que fazer agora (máx 6 palavras)",
      "corpo": "Passo acionável e concreto. Ferramenta ou estratégia específica se possível.",
      "imageQuery": "keywords in English for action/solution image"
    },
    {
      "titulo": "Sua empresa está preparada? (máx 7 palavras)",
      "corpo": "Pergunta provocativa que gera reflexão e comentários.",
      "imageQuery": "keywords in English for entrepreneur thinking future"
    }
  ],
  "legenda": "Legenda para Instagram: primeira frase = manchete do fato real. Parágrafos curtos. Emojis usados com moderação e intenção. 15-20 hashtags ao final: misture populares e de nicho (#iaparaempresas #inteligenciaartificial #negocios #empreendedorismo #automacao #gestao #transformacaodigital #iabusiness #tecnologia #startups)"
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
