import {
  aggregateBy,
  byHour,
  byWeekday,
  engagementRate,
  formatPercent,
  type PostLike,
} from "@/lib/metrics";
import { mediaTypeLabel } from "@/lib/constants";

export interface Recommendation {
  title: string;
  detail: string;
  impact: "alto" | "médio" | "baixo";
}

/**
 * Motor de recomendações simples baseado no histórico.
 * À medida que mais posts entram, as sugestões ficam mais precisas.
 */
export function buildRecommendations(posts: PostLike[]): Recommendation[] {
  const recs: Recommendation[] = [];
  if (posts.length < 3) {
    recs.push({
      title: "Conecte mais dados",
      detail:
        "Com poucos posts ainda não dá pra encontrar padrões confiáveis. Sincronize sua conta ou importe seu histórico para ativar as recomendações.",
      impact: "alto",
    });
    return recs;
  }

  // 1) Melhor formato
  const byType = aggregateBy(posts, "mediaType").filter((g) => g.count >= 2);
  if (byType.length > 0) {
    const best = byType[0];
    const worst = byType[byType.length - 1];
    recs.push({
      title: `Priorize ${mediaTypeLabel(best.key)}`,
      detail:
        `${mediaTypeLabel(best.key)} tem a maior taxa de engajamento média (${formatPercent(
          best.avgEngagementRate
        )})` +
        (worst.key !== best.key
          ? `, contra ${formatPercent(worst.avgEngagementRate)} de ${mediaTypeLabel(
              worst.key
            )}. Realoque parte da produção para esse formato.`
          : "."),
      impact: "alto",
    });
  }

  // 2) Melhor tema/categoria
  const byCat = aggregateBy(
    posts.filter((p) => p.category),
    "category"
  ).filter((g) => g.count >= 2);
  if (byCat.length > 0) {
    const best = byCat[0];
    recs.push({
      title: `Tema que mais engaja: "${best.key}"`,
      detail: `Posts de "${best.key}" rendem em média ${formatPercent(
        best.avgEngagementRate
      )} de engajamento (${best.count} posts). Explore mais variações desse tema.`,
      impact: "alto",
    });
  }

  // 3) Melhor dia da semana
  const days = byWeekday(posts).filter((d) => d.posts >= 1);
  if (days.length > 0) {
    const bestDay = [...days].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
    recs.push({
      title: `Melhor dia: ${bestDay.weekday}`,
      detail: `${bestDay.weekday} concentra seu maior engajamento médio (${formatPercent(
        bestDay.avgEngagementRate
      )}). Programe seus posts mais importantes para esse dia.`,
      impact: "médio",
    });
  }

  // 4) Melhor horário
  const hours = byHour(posts).filter((h) => h.posts >= 1);
  if (hours.length > 0) {
    const bestHour = [...hours].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
    recs.push({
      title: `Melhor horário: por volta de ${bestHour.label}`,
      detail: `Seus posts publicados perto de ${bestHour.label} performam acima da média. Teste manter essa janela de publicação.`,
      impact: "médio",
    });
  }

  // 5) Salvamentos como sinal forte do algoritmo
  const avgSaves =
    posts.reduce((s, p) => s + p.saves, 0) / Math.max(posts.length, 1);
  const topSaved = [...posts].sort((a, b) => b.saves - a.saves)[0];
  if (topSaved && topSaved.saves > avgSaves * 1.5) {
    recs.push({
      title: "Aposte em conteúdo 'salvável'",
      detail: `Salvamentos pesam muito no algoritmo. Seu post com mais saves (${topSaved.saves}) supera a média (${avgSaves.toFixed(
        0
      )}). Conteúdo de referência/tutorial costuma gerar mais salvamentos.`,
      impact: "alto",
    });
  }

  // 6) Consistência de postagem
  const sorted = [...posts].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
  if (sorted.length >= 2) {
    const spanDays =
      (sorted[sorted.length - 1].postedAt.getTime() - sorted[0].postedAt.getTime()) /
      86_400_000;
    const perWeek = spanDays > 0 ? (posts.length / spanDays) * 7 : 0;
    if (perWeek < 3) {
      recs.push({
        title: "Aumente a frequência",
        detail: `Você publica cerca de ${perWeek.toFixed(
          1
        )} posts/semana. Contas em crescimento costumam manter de 3 a 5. Mais consistência tende a ampliar o alcance.`,
        impact: "médio",
      });
    }
  }

  return recs;
}

/** Pequeno resumo "1 frase" do que o algoritmo está favorecendo. */
export function headlineInsight(posts: PostLike[]): string | null {
  if (posts.length < 3) return null;
  const byType = aggregateBy(posts, "mediaType").filter((g) => g.count >= 2);
  if (byType.length === 0) return null;
  const best = byType[0];
  return `${mediaTypeLabel(best.key)} é hoje seu formato de maior engajamento (${formatPercent(
    best.avgEngagementRate
  )} em média).`;
}