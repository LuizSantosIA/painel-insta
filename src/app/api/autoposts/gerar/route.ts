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

// ── Busca imagem via Unsplash API (com fallback para mapa estático) ──────────

// ── Detecção de empresa (nome + cor da marca) ────────────────────────────────

interface CompanyBrand { name: string; color: string }

const COMPANY_BRANDS: { keywords: string[]; name: string; color: string }[] = [
  { keywords: ["shopify"],                                    name: "Shopify",    color: "#96BF48" },
  { keywords: ["tesla"],                                      name: "Tesla",      color: "#E31937" },
  { keywords: ["spacex"],                                     name: "SpaceX",     color: "#005288" },
  { keywords: ["openai", "chatgpt", "gpt-4", "gpt4"],        name: "OpenAI",     color: "#10A37F" },
  { keywords: ["anthropic", "claude"],                        name: "Anthropic",  color: "#D97706" },
  { keywords: ["gemini", "deepmind"],                         name: "Google",     color: "#4285F4" },
  { keywords: ["google"],                                     name: "Google",     color: "#4285F4" },
  { keywords: ["meta", "facebook", "whatsapp", "llama"],      name: "Meta",       color: "#0082FB" },
  { keywords: ["microsoft", "copilot", "azure", "bing"],      name: "Microsoft",  color: "#00BCF2" },
  { keywords: ["amazon", "aws"],                              name: "Amazon",     color: "#FF9900" },
  { keywords: ["apple", "iphone", "ipad", "macbook"],         name: "Apple",      color: "#555555" },
  { keywords: ["nvidia", "gpu"],                              name: "NVIDIA",     color: "#76B900" },
  { keywords: ["uber"],                                       name: "Uber",       color: "#000000" },
  { keywords: ["netflix"],                                    name: "Netflix",    color: "#E50914" },
  { keywords: ["samsung"],                                    name: "Samsung",    color: "#1428A0" },
  { keywords: ["airbnb"],                                     name: "Airbnb",     color: "#FF5A5F" },
  { keywords: ["zoom"],                                       name: "Zoom",       color: "#2D8CFF" },
  { keywords: ["slack"],                                      name: "Slack",      color: "#4A154B" },
  { keywords: ["x.ai", "grok", "xai"],                        name: "xAI",        color: "#ffffff" },
  { keywords: ["linkedin"],                                   name: "LinkedIn",   color: "#0A66C2" },
  { keywords: ["tiktok", "bytedance"],                        name: "TikTok",     color: "#010101" },
  { keywords: ["adobe"],                                      name: "Adobe",      color: "#FF0000" },
  { keywords: ["salesforce"],                                 name: "Salesforce", color: "#00A1E0" },
  { keywords: ["hubspot"],                                    name: "HubSpot",    color: "#FF7A59" },
  { keywords: ["stripe"],                                     name: "Stripe",     color: "#635BFF" },
  { keywords: ["figma"],                                      name: "Figma",      color: "#F24E1E" },
  { keywords: ["notion"],                                     name: "Notion",     color: "#000000" },
  { keywords: ["canva"],                                      name: "Canva",      color: "#00C4CC" },
];

function detectCompanyBrand(topico: string, imageQuery: string): CompanyBrand | null {
  const text = `${topico} ${imageQuery}`.toLowerCase();
  for (const entry of COMPANY_BRANDS) {
    if (entry.keywords.some(kw => text.includes(kw))) {
      return { name: entry.name, color: entry.color };
    }
  }
  return null;
}

async function fetchUnsplashImage(query: string, topico: string): Promise<string> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (key) {
    try {
      const searchQuery = `${query} ${topico}`.trim().slice(0, 100);
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=squarish&content_filter=high`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${key}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json() as {
          results: Array<{ urls: { raw: string }; links: { download_location: string } }>;
        };
        if (data.results?.length) {
          const photo = data.results[Math.floor(Math.random() * Math.min(data.results.length, 5))];
          // Unsplash TOS: disparar download
          if (photo.links?.download_location) {
            fetch(photo.links.download_location, {
              headers: { Authorization: `Client-ID ${key}` },
            }).catch(() => {});
          }
          return `${photo.urls.raw}&w=1080&h=1080&fit=crop&auto=format`;
        }
      }
    } catch { /* cai no fallback estático */ }
  }
  return buildImageUrl(query, topico);
}

// Mapa estático de fallback — usado quando Unsplash não está configurado ou falha
// Empresas específicas vêm PRIMEIRO para ter prioridade sobre categorias genéricas
const TOPIC_IMAGES: { keywords: string[]; urls: string[] }[] = [
  // ── Empresas específicas ──────────────────────────────────────────────────
  {
    keywords: ["shopify"],
    urls: [
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["tesla"],
    urls: [
      "https://images.unsplash.com/photo-1620714223084-8fcacc2dbe4d?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["spacex"],
    urls: [
      "https://images.unsplash.com/photo-1517976487492-5750f3195933?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["openai", "chatgpt", "gpt-4", "gpt4"],
    urls: [
      "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1675557009875-436f7a7a5cf6?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["anthropic", "claude"],
    urls: [
      "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["google", "gemini", "deepmind"],
    urls: [
      "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["meta", "facebook", "whatsapp", "llama"],
    urls: [
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["microsoft", "copilot", "azure", "bing"],
    urls: [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["amazon", "aws"],
    urls: [
      "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["apple", "iphone", "ipad", "macbook"],
    urls: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["nvidia", "gpu", "chip", "semiconductor"],
    urls: [
      "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["uber", "lyft", "rideshare", "transporte"],
    urls: [
      "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["netflix", "streaming", "disney", "entretenimento"],
    urls: [
      "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["samsung", "lg", "qualcomm"],
    urls: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["airbnb", "booking", "hotel", "viagem", "travel"],
    urls: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["zoom", "slack", "teams", "videoconferencia", "remote", "home office"],
    urls: [
      "https://images.unsplash.com/photo-1588702547919-26089e690ecc?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["x.ai", "grok", "xai"],
    urls: [
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1080&h=1080&fit=crop",
    ],
  },
  // ── Categorias genéricas ──────────────────────────────────────────────────
  {
    keywords: ["ai", "artificial intelligence", "llm", "machine learning", "neural", "deep learning", "inteligencia artificial"],
    urls: [
      "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1675557009875-436f7a7a5cf6?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["robot", "automation", "automate", "automacao", "automatico"],
    urls: [
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["ecommerce", "shop", "shopping", "loja", "varejo", "retail", "store"],
    urls: [
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["startup", "entrepreneur", "empreendedor", "founder", "venture", "investimento", "funding", "saas"],
    urls: [
      "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["finance", "financeiro", "money", "dinheiro", "bank", "banco", "investment", "stock", "market", "crypto", "bitcoin"],
    urls: [
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1611186871525-9f9a82ca2df2?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["data", "analytics", "dashboard", "insight", "metrics", "dados", "analysis", "database"],
    urls: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["cloud", "server", "infrastructure", "hosting", "nuvem"],
    urls: [
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["marketing", "social media", "content", "brand", "audience", "conteudo", "trafego", "anuncio", "ad"],
    urls: [
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["energy", "electric", "solar", "battery", "energia", "sustentabilidade"],
    urls: [
      "https://images.unsplash.com/photo-1507908708918-778587c9e563?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["security", "segurança", "hack", "cyber", "privacy", "privacidade", "protection"],
    urls: [
      "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["health", "saude", "hospital", "medical", "medicine", "biotech"],
    urls: [
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["mobile", "smartphone", "app", "android", "celular"],
    urls: [
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1080&h=1080&fit=crop",
    ],
  },
  {
    keywords: ["team", "meeting", "equipe", "reuniao", "lideranca", "gestao", "management", "business"],
    urls: [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1080&h=1080&fit=crop",
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1080&h=1080&fit=crop",
    ],
  },
];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1080&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1488229297570-58520851e868?w=1080&h=1080&fit=crop",
];

function buildImageUrl(query: string, topico: string): string {
  const text = `${query} ${topico}`.toLowerCase();

  for (const entry of TOPIC_IMAGES) {
    if (entry.keywords.some(kw => text.includes(kw))) {
      // Escolhe URL deterministicamente pelo texto (variedade entre posts do mesmo tema)
      let h = 0;
      for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) & 0xffffff;
      return entry.urls[h % entry.urls.length];
    }
  }

  // Fallback genérico de tecnologia
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) & 0xffffff;
  return FALLBACK_IMAGES[h % FALLBACK_IMAGES.length];
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

  // CAPA: nome da empresa (sem foto) ou foto do Unsplash (sem empresa)
  const capaQuery   = parsed.slides[0]?.imageQuery ?? "";
  const capaBrand   = detectCompanyBrand(parsed.topico, capaQuery);
  const capaImageUrl = capaBrand ? null : await fetchUnsplashImage(capaQuery, parsed.topico);

  const slidesWithImages = parsed.slides.map((slide, i) => ({
    ...slide,
    imageUrl:    i === 0 ? capaImageUrl       : null,
    companyName: i === 0 ? (capaBrand?.name  ?? null) : null,
    brandColor:  i === 0 ? (capaBrand?.color ?? null) : null,
  }));

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
