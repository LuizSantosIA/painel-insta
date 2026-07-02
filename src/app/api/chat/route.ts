import { NextRequest, NextResponse } from "next/server";
import { getAllPosts, getAccountSnapshots } from "@/lib/data";
import {
  aggregateBy,
  byHour,
  byWeekday,
  engagementRate,
  formatNumber,
  formatPercent,
  rankPosts,
} from "@/lib/metrics";
import { mediaTypeLabel } from "@/lib/constants";
import { fetchFollowersCount } from "@/lib/instagram";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function buildSystemPrompt(): Promise<string> {
  const [posts, snapshots, liveFollowers] = await Promise.all([
    getAllPosts(),
    getAccountSnapshots(),
    fetchFollowersCount(),
  ]);

  const followers =
    liveFollowers ?? snapshots[snapshots.length - 1]?.followers ?? 0;
  const avgER =
    posts.length > 0
      ? posts.reduce((s, p) => s + engagementRate(p), 0) / posts.length
      : 0;
  const totalSaves = posts.reduce((s, p) => s + p.saves, 0);
  const totalReach = posts.reduce((s, p) => s + p.reach, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);

  const byType = aggregateBy(posts, "mediaType");
  const byCategory = aggregateBy(posts, "category").slice(0, 5);
  const weekdays = byWeekday(posts);
  const hours = byHour(posts).filter((h) => h.posts > 0);
  const top5 = rankPosts(posts, "engagement", 5);
  const recent = posts.slice(0, 10);

  const bestDay = [...weekdays]
    .filter((d) => d.posts > 0)
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
  const bestHour = [...hours].sort(
    (a, b) => b.avgEngagementRate - a.avgEngagementRate
  )[0];
  const worstHour = [...hours].sort(
    (a, b) => a.avgEngagementRate - b.avgEngagementRate
  )[0];

  if (posts.length === 0) {
    return `Você é um assistente de marketing para Instagram. O perfil ainda não tem posts sincronizados no painel. Oriente o usuário a acessar a página de Integração e clicar em "Sincronizar agora" para importar os dados reais. Responda em português do Brasil.`;
  }

  return `Você é um assistente especialista em marketing digital para Instagram, com acesso completo e exclusivo aos dados reais do perfil do usuário abaixo. Use esses dados para responder com precisão e dar conselhos altamente personalizados.

━━━ DADOS DO PERFIL ━━━

📊 VISÃO GERAL
• Seguidores: ${formatNumber(followers)}
• Posts no painel: ${posts.length}
• Engajamento médio: ${formatPercent(avgER)}
• Total curtidas: ${formatNumber(totalLikes)}
• Total comentários: ${formatNumber(totalComments)}
• Total salvamentos: ${formatNumber(totalSaves)}
• Alcance total: ${formatNumber(totalReach)}

🏆 TOP 5 POSTS (por engajamento total)
${top5
  .map((p, i) => {
    const date = p.postedAt.toLocaleDateString("pt-BR");
    const cap = (p.caption ?? "Sem legenda").slice(0, 80);
    return `${i + 1}. [${date}] ${mediaTypeLabel(p.mediaType)} — "${cap}" — Eng: ${formatPercent(engagementRate(p))} — ${p.likes} likes — alcance ${formatNumber(p.reach)}`;
  })
  .join("\n")}

📈 PERFORMANCE POR TIPO DE CONTEÚDO
${byType
  .map(
    (t) =>
      `• ${mediaTypeLabel(t.key)}: ${t.count} posts | eng. médio ${formatPercent(t.avgEngagementRate)} | alcance médio ${formatNumber(t.avgReach)} | saves médio ${formatNumber(t.avgSaves)}`
  )
  .join("\n")}

🏷️ PERFORMANCE POR TEMA (top 5)
${
  byCategory.length > 0
    ? byCategory
        .map(
          (c) =>
            `• ${c.key}: ${c.count} posts | eng. médio ${formatPercent(c.avgEngagementRate)} | alcance médio ${formatNumber(c.avgReach)}`
        )
        .join("\n")
    : "• Nenhum tema categorizado ainda"
}

📅 MELHORES MOMENTOS PARA POSTAR
• Melhor dia: ${bestDay?.weekday ?? "—"} (eng. ${bestDay ? formatPercent(bestDay.avgEngagementRate) : "—"}, ${bestDay?.posts ?? 0} posts)
• Melhor horário: ${bestHour ? `${String(bestHour.hour).padStart(2, "0")}h` : "—"} (eng. ${bestHour ? formatPercent(bestHour.avgEngagementRate) : "—"})
• Pior horário: ${worstHour ? `${String(worstHour.hour).padStart(2, "0")}h` : "—"} (eng. ${worstHour ? formatPercent(worstHour.avgEngagementRate) : "—"})

📝 POSTS RECENTES (últimos ${recent.length})
${recent
  .map((p) => {
    const date = p.postedAt.toLocaleDateString("pt-BR");
    const cap = (p.caption ?? "Sem legenda").slice(0, 60);
    return `• [${date}] ${mediaTypeLabel(p.mediaType)} — "${cap}" — ${p.likes} likes, ${p.comments} coments, ${formatPercent(engagementRate(p))} eng.`;
  })
  .join("\n")}

━━━ INSTRUÇÕES ━━━
• Responda SEMPRE em português do Brasil
• Seja direto, prático e baseie tudo nos dados reais acima
• Quando sugerir estratégias, cite os números do perfil para embasar
• Seja amigável, como um consultor de marketing experiente
• Se perguntarem sobre um post específico, busque nos dados fornecidos`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no .env" },
      { status: 500 }
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages ?? [];
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const systemPrompt = await buildSystemPrompt();

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => ({}));
    const msg =
      (err as { error?: { message?: string } })?.error?.message ??
      "Erro na API da OpenAI";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return new Response(openaiRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}