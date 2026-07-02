// Tipos de mídia retornados pela Graph API do Instagram.
export const MEDIA_TYPES = [
  "REELS",
  "CAROUSEL_ALBUM",
  "IMAGE",
  "VIDEO",
  "STORY",
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  REELS: "Reels",
  CAROUSEL_ALBUM: "Carrossel",
  IMAGE: "Foto",
  VIDEO: "Vídeo",
  STORY: "Story",
};

export const MEDIA_TYPE_COLORS: Record<MediaType, string> = {
  REELS: "#2563EB",
  CAROUSEL_ALBUM: "#4338CA",
  IMAGE: "#0891B2",
  VIDEO: "#F59E0B",
  STORY: "#06B6D4",
};

// Categorias/temas sugeridos. Você pode editar livremente por post.
export const DEFAULT_CATEGORIES = [
  "Dica",
  "Bastidores",
  "Promoção",
  "Educativo",
  "Inspiração",
  "Depoimento",
  "Novidade",
  "Trend",
] as const;

export const PALETTE = [
  "#2563EB",
  "#4338CA",
  "#0891B2",
  "#F59E0B",
  "#06B6D4",
  "#27ae60",
  "#f2994a",
  "#eb5757",
  "#7C3AED",
  "#2d9cdb",
];

export function mediaTypeLabel(type: string): string {
  return MEDIA_TYPE_LABELS[type as MediaType] ?? type;
}

export function mediaTypeColor(type: string): string {
  return MEDIA_TYPE_COLORS[type as MediaType] ?? "#888888";
}