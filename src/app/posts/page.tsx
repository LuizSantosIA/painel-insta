import { getAllPosts } from "@/lib/data";
import { engagement, engagementRate } from "@/lib/metrics";
import { PostsTable, type PostRow } from "@/components/posts-table";
import { HashtagTable } from "@/components/hashtag-table";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await getAllPosts();

  const rows: PostRow[] = posts.map((p) => ({
    id: p.id,
    caption: p.caption,
    mediaType: p.mediaType,
    category: p.category,
    permalink: p.permalink,
    thumbnailUrl: p.thumbnailUrl,
    postedAt: p.postedAt.toISOString(),
    likes: p.likes,
    comments: p.comments,
    saves: p.saves,
    shares: p.shares,
    reach: p.reach,
    impressions: p.impressions,
    videoViews: p.videoViews,
    engagement: engagement(p),
    engagementRate: engagementRate(p),
  }));

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-sm text-muted">
            Todos os seus conteúdos. Clique nas colunas para ordenar e defina o tema de cada post.
          </p>
        </header>
        <PostsTable initial={rows} />
      </div>

      <div className="border-t border-border pt-8">
        <HashtagTable posts={rows} />
      </div>
    </div>
  );
}