import { NextRequest, NextResponse } from "next/server";
import { getAllPosts } from "@/lib/data";
import { engagement, engagementRate, rankPosts } from "@/lib/metrics";
import { mediaTypeLabel } from "@/lib/constants";

const MEDIA_LABELS: Record<string, string> = {
  REELS: "Reel",
  CAROUSEL_ALBUM: "Carrossel",
  IMAGE: "Foto",
};

const TONE_DESCRIPTIONS: Record<string, string> = {
  educativo: "educativo e informativo, com dicas práticas",
  inspiracional: "inspiracional e motivacional, que gera emoção",
  promocional: "promocional e persuasivo, com senso de urgência",
  casual: "casual e descontraído, como uma conversa com um amigo",
};

interface GenerateRequest {
  type: string;
  tone: string;
  topic: string;
  includeHashtags: boolean;
}

interface CaptionOption {
  text: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no .env" },
      { status: 500 }
    );
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { type, tone, topic, includeHashtags } = body;
  if (!topic?.trim()) {
    return NextResponse.json({ error: "Campo 'topic' é obrigatório." }, { status: 400 });
  }

  const posts = await getAllPosts();
  const top10 = rankPosts(posts, "engagementRate", 10);

  const examples = top10
    .map((p) => {
      const caption = p.caption?.slice(0, 200) ?? "Sem legenda";
      const er = engagementRate(p).toFixed(1);
      const eng = engagement(p);
      return `- [${mediaTypeLabel(p.mediaType)}] Eng: ${er}% | Interações: ${eng} | Legenda: "${caption}"`;
    })
    .join("\n");

  const toneDesc = TONE_DESCRIPTIONS[tone] ?? tone;
  const postTypeLabel = MEDIA_LABELS[type] ?? type;
  const hashtagInstruction = includeHashtags
    ? "Ao final de cada legenda, inclua uma linha em branco seguida de 10 a 15 hashtags relevantes."
    : "Não inclua hashtags.";

  const prompt = `Você é um especialista em marketing de conteúdo para Instagram, com foco em crescimento orgânico e engajamento.

Aqui estão os 10 posts com maior engajamento do perfil (use como referência de estilo, tom, comprimento e uso de emojis):
${examples}

Sua tarefa: gere EXATAMENTE 3 opções de legenda para um novo post de Instagram.

Especificações do post:
- Tipo: ${postTypeLabel}
- Tom: ${toneDesc}
- Assunto: ${topic}
${hashtagInstruction}

Regras para cada legenda:
- Escreva em português do Brasil
- Use emojis de forma natural e relevante
- Inclua um CTA (call-to-action) claro no final
- Entre 100 e 300 caracteres no corpo principal (sem contar hashtags)
- Inspire-se no estilo dos exemplos acima

Retorne APENAS um JSON válido, sem explicações, sem markdown, sem texto fora do JSON:
{"options":[{"text":"legenda completa aqui"},{"text":"legenda completa aqui"},{"text":"legenda completa aqui"}]}`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } })?.error?.message ?? "Erro na API da OpenAI";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const openaiData = await openaiRes.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = openaiData.choices?.[0]?.message?.content ?? "";

  let options: CaptionOption[];
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? text) as { options?: CaptionOption[] };
    options = parsed.options ?? [];
  } catch {
    return NextResponse.json(
      { error: "Resposta inválida da IA. Tente novamente." },
      { status: 500 }
    );
  }

  if (!Array.isArray(options) || options.length === 0) {
    return NextResponse.json(
      { error: "A IA não retornou opções válidas. Tente novamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ options });
}