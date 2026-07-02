import { getAllPosts } from "@/lib/data";
import { engagement, engagementRate } from "@/lib/metrics";
import { CalendarView, type CalendarPost } from "@/components/calendar-view";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const posts = await getAllPosts();

  if (posts.length < 5) {
    return (
      <div className="max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Calendário editorial</h1>
          <p className="text-sm text-muted">Visualize seus posts publicados mês a mês.</p>
        </header>
        <div className="card p-8 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted" />
          <p className="font-medium">Dados insuficientes</p>
          <p className="mt-1 text-sm text-muted">
            Sincronize pelo menos 5 posts para ver o calendário editorial.
          </p>
        </div>
      </div>
    );
  }

  const calPosts: CalendarPost[] = posts.map((p) => ({
    id: p.id,
    caption: p.caption,
    mediaType: p.mediaType,
    thumbnailUrl: p.thumbnailUrl,
    permalink: p.permalink,
    postedAt: p.postedAt.toISOString(),
    likes: p.likes,
    comments: p.comments,
    saves: p.saves,
    shares: p.shares,
    reach: p.reach,
    engagement: engagement(p),
    engagementRate: engagementRate(p),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendário editorial</h1>
        <p className="text-sm text-muted">
          {posts.length} posts publicados. Clique em qualquer post para ver suas métricas.
        </p>
      </header>
      <CalendarView posts={calPosts} />
    </div>
  );
}