/**
 * Tradução do que o actor de Google Maps devolve para o nosso formato.
 *
 * Pura: recebe o item cru, devolve o candidato. Fica separada porque o formato
 * do actor é de terceiro e muda — quando mudar, muda só aqui, e os testes
 * dizem na hora o que quebrou.
 */

import { normalizarTelefone, whatsAppDaUrl, type TipoTelefone } from "./telefone";

/** O que o compass/crawler-google-places devolve, nos campos que usamos. */
export interface ItemMaps {
  placeId?: string;
  title?: string;
  address?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  categories?: string[];
  categoryName?: string;
  openingHours?: unknown;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  reviews?: { text?: string; stars?: number; publishedAtDate?: string; name?: string }[];
  /** O actor às vezes traz os perfis sociais achados no site. */
  instagrams?: string[];
  facebooks?: string[];
  url?: string;
}

export interface Avaliacao {
  texto: string;
  estrelas: number | null;
  em: string | null;
}

export interface CandidatoMaps {
  placeId: string;
  nome: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  telefone: string | null;
  telefoneE164: string | null;
  tipoTelefone: TipoTelefone;
  site: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  notaMaps: number | null;
  totalAvaliacoes: number;
  categorias: string;
  horario: string | null;
  avaliacoes: Avaliacao[];
}

const MAX_AVALIACOES = 10;

function primeiro(...v: (string | undefined | null)[]): string | null {
  for (const x of v) if (x && x.trim()) return x.trim();
  return null;
}

/**
 * Converte o item cru. Devolve null quando falta o mínimo (place_id e nome) ou
 * quando a empresa está fechada — não adianta prospectar quem fechou.
 */
export function traduzirItemMaps(
  item: ItemMaps,
  contexto: { cidadeBusca: string; ufPadrao: string }
): CandidatoMaps | null {
  const placeId = primeiro(item.placeId);
  const nome = primeiro(item.title);
  if (!placeId || !nome) return null;
  if (item.permanentlyClosed || item.temporarilyClosed) return null;

  const bruto = primeiro(item.phoneUnformatted, item.phone);
  const tel = normalizarTelefone(bruto);

  const site = primeiro(item.website);
  // Um wa.me no site vale mais que o fixo da recepção.
  const waSite = whatsAppDaUrl(site);
  const whatsapp = waSite?.e164 ?? (tel?.tipo === "CELULAR" ? tel.e164 : null);

  const categorias = (item.categories ?? [item.categoryName].filter(Boolean) as string[])
    .map((c) => c.trim())
    .filter(Boolean)
    .join(", ");

  const avaliacoes: Avaliacao[] = (item.reviews ?? [])
    .filter((r) => (r.text ?? "").trim().length > 0)
    .slice(0, MAX_AVALIACOES)
    .map((r) => ({
      texto: (r.text ?? "").trim(),
      estrelas: typeof r.stars === "number" ? r.stars : null,
      em: r.publishedAtDate ?? null,
    }));

  return {
    placeId,
    nome,
    endereco: primeiro(item.address, item.street),
    bairro: primeiro(item.neighborhood),
    cidade: primeiro(item.city) ?? contexto.cidadeBusca,
    uf: primeiro(item.state) ?? contexto.ufPadrao,
    telefone: bruto,
    telefoneE164: tel?.e164 ?? null,
    tipoTelefone: tel?.tipo ?? "SEM",
    site,
    instagram: primeiro(item.instagrams?.[0]),
    facebook: primeiro(item.facebooks?.[0]),
    whatsapp,
    notaMaps: typeof item.totalScore === "number" ? item.totalScore : null,
    totalAvaliacoes: item.reviewsCount ?? 0,
    categorias,
    horario: item.openingHours ? JSON.stringify(item.openingHours) : null,
    avaliacoes,
  };
}

/**
 * Entrada do actor para uma vertical em uma cidade.
 *
 * `language: "pt-BR"` porque as avaliações são o insumo da IA e precisam vir em
 * português; `maxReviews` limitado porque só as recentes importam e cada
 * avaliação é custo.
 */
export function montarInputMaps(dados: {
  termos: string[];
  cidade: string;
  uf: string;
  maxResultados: number;
}): Record<string, unknown> {
  return {
    searchStringsArray: dados.termos,
    locationQuery: `${dados.cidade}, ${dados.uf}, Brasil`,
    maxCrawledPlacesPerSearch: Math.max(1, Math.ceil(dados.maxResultados / Math.max(1, dados.termos.length))),
    language: "pt-BR",
    maxReviews: MAX_AVALIACOES,
    reviewsSort: "newest",
    scrapeReviewerName: false,
    skipClosedPlaces: true,
    website: "allPlaces",
  };
}
