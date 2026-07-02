import { Film, Images, ImageIcon, Video, Circle } from "lucide-react";
import { mediaTypeColor, mediaTypeLabel, type MediaType } from "@/lib/constants";

const ICONS: Record<string, typeof Film> = {
  REELS: Film,
  CAROUSEL_ALBUM: Images,
  IMAGE: ImageIcon,
  VIDEO: Video,
  STORY: Circle,
};

export function MediaBadge({ type }: { type: string }) {
  const color = mediaTypeColor(type);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: `${color}22`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {mediaTypeLabel(type)}
    </span>
  );
}

export function PostThumb({
  type,
  url,
  size = 44,
}: {
  type: string;
  url?: string | null;
  size?: number;
}) {
  const Icon = ICONS[type as MediaType] ?? ImageIcon;
  const color = mediaTypeColor(type);
  if (url) {
    // Mídia do Instagram (URLs de CDN expiram; <img> simples evita config extra).
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-lg object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}33, ${color}11)`,
        border: `1px solid ${color}33`,
      }}
    >
      <Icon className="h-1/2 w-1/2" style={{ color }} />
    </div>
  );
}