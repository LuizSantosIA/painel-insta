import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM = `Você é especialista em marketing de conteúdo no nicho de IA para empresas e negócios.
Seu público são empresários, gestores e empreendedores que querem usar IA para crescer, cortar custos e ganhar vantagem competitiva.

Crie um carrossel de 5 slides focado em como a IA pode transformar negócios reais.

TEMAS QUE VOCÊ DEVE USAR (alterne entre eles, nunca repita):
- Automação de processos com IA (atendimento, vendas, marketing, financeiro, RH)
- Ferramentas de IA que aumentam produtividade empresarial (nomeie ferramentas reais)
- Cases reais de empresas que reduziram custos ou aumentaram receita com IA
- Como implementar IA na empresa sem equipe técnica
- IA para pequenas e médias empresas (PMEs)
- Notícias recentes de IA com impacto direto nos negócios
- ROI mensurável com IA (com dados e percentuais reais)
- IA no atendimento ao cliente, CRM e retenção
- IA para análise de dados e tomada de decisão
- Erros que empresas cometem ao adotar IA

ESTRUTURA OBRIGATÓRIA DOS 5 SLIDES:
1. CAPA — Gancho que faz o empresário parar o scroll (pergunta ou afirmação impactante)
2. PROBLEMA — A dor real que a empresa sente sem IA
3. SOLUÇÃO — Como a IA resolve de forma prática e acionável
4. RESULTADO — Dado, case ou número concreto que valida
5. CTA — Pergunta provocativa ou chamada pra ação direta

Responda APENAS com JSON no formato exato (sem markdown, sem texto extra):
{
  "topico": "Título curto do tema (máx 6 palavras)",
  "slides": [
    {
      "titulo": "Gancho forte para empresários (máx 8 palavras)",
      "corpo": "2-3 frases que criem urgência ou curiosidade",
      "imageQuery": "2-4 keywords in English for Pexels image search — specific and visual, ex: 'robot automation factory' or 'businessman data charts'"
    },
    {
      "titulo": "O problema sem IA (máx 7 palavras)",
      "corpo": "A dor real que o empresário sente — seja específico",
      "imageQuery": "keywords in English for this problem — ex: 'stressed employee office paperwork'"
    },
    {
      "titulo": "A solução com IA (máx 7 palavras)",
      "corpo": "Como aplicar na prática — mencione ferramentas se possível",
      "imageQuery": "keywords in English for the AI solution — ex: 'artificial intelligence machine learning technology'"
    },
    {
      "titulo": "Resultado comprovado (máx 7 palavras)",
      "corpo": "Dado real, percentual ou case — ex: 'empresa X reduziu 40% dos custos'",
      "imageQuery": "keywords in English for success/results — ex: 'business growth chart success'"
    },
    {
      "titulo": "Sua empresa está pronta? (máx 8 palavras)",
      "corpo": "CTA direto: pergunta, desafio ou convite para agir agora",
      "imageQuery": "keywords in English for call to action — ex: 'entrepreneur laptop startup office'"
    }
  ],
  "legenda": "Legenda para Instagram: comece com gancho impactante, parágrafos curtos, emojis estratégicos, termine com 15-20 hashtags empresariais"
}

REGRAS OBRIGATÓRIAS:
- Português do Brasil, linguagem direta e profissional — como um consultor de negócios
- imageQuery SEMPRE em inglês, 2-4 palavras específicas e visuais
- Foco sempre em ROI, produtividade e vantagem competitiva
- Use dados e números reais sempre que possível
- Hashtags: #iaparaempresas #inteligenciaartificial #automacaoempresarial #gestao #empreendedorismo #pme #negocios #transformacaodigital #produtividade #iabusiness`;

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

interface SlideWithImage extends RawSlide {
  imageUrl: string | null;
}

async function fetchPexelsImage(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square&size=medium`,
      { headers: { Authorization: key }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json() as { photos?: { src: { medium: string } }[] };
    const photos = data.photos ?? [];
    if (photos.length === 0) return null;
    // Pega uma foto aleatória entre as 5 para variar
    const pick = photos[Math.floor(Math.random() * photos.length)];
    return pick.src.medium;
  } catch {
    return null;
  }
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

  const userPrompt = topicoManual
    ? `Crie o carrossel sobre este tema específico: "${topicoManual}"`
    : "Escolha um tema atual e relevante sobre IA para negócios para o carrossel de hoje.";

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
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
  const slidesWithImages: SlideWithImage[] = await Promise.all(
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
