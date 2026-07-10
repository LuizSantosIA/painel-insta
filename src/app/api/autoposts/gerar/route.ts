import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM = `Você é especialista em criação de conteúdo para Instagram sobre Inteligência Artificial.
Crie um carrossel de 5 slides com tema atual e relevante sobre IA.
Responda APENAS com JSON no formato exato abaixo (sem markdown, sem texto extra):
{
  "topico": "Título curto do tema (máx 6 palavras)",
  "slides": [
    {"titulo": "Gancho forte — 1ª slide (máx 8 palavras)", "corpo": "Texto de 2-3 frases diretas e envolventes"},
    {"titulo": "Ponto principal 1 (máx 7 palavras)", "corpo": "2-3 frases explicando o ponto"},
    {"titulo": "Ponto principal 2 (máx 7 palavras)", "corpo": "2-3 frases explicando o ponto"},
    {"titulo": "Ponto principal 3 (máx 7 palavras)", "corpo": "2-3 frases explicando o ponto"},
    {"titulo": "Conclusão com CTA (máx 8 palavras)", "corpo": "Encerre com pergunta ou chamada pra ação clara"}
  ],
  "legenda": "Legenda completa para Instagram com emojis relevantes, parágrafos curtos e 15-20 hashtags ao final"
}
Regras obrigatórias:
- Português do Brasil, linguagem acessível
- Evite jargão técnico excessivo
- Legenda começa com frase de impacto (gancho)
- Hashtags: misture populares e de nicho (#inteligenciaartificial #ia #tech #automacao etc)`;

interface ParsedContent {
  topico: string;
  slides: { titulo: string; corpo: string }[];
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

  const userPrompt = topicoManual
    ? `Crie o carrossel sobre este tema específico: "${topicoManual}"`
    : "Escolha um tema atual e relevante sobre IA para o carrossel de hoje.";

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

  const rascunho = await prisma.postRascunho.create({
    data: {
      topico: parsed.topico,
      slides: JSON.stringify(parsed.slides),
      legenda: parsed.legenda,
      status: "RASCUNHO",
      atualizadoEm: new Date(),
    },
  });

  return NextResponse.json(rascunho, { status: 201 });
}
