import "server-only";
import { prisma } from "@/lib/prisma";
import { radarResumirFonte } from "./agentes";

/**
 * RADAR — Fase 1: lê o que você cola.
 *
 * Não raspa o Instagram (mesma regra da prospecção: viola os termos e arrisca a
 * conta). Recebe URLs, baixa a página, extrai o texto e manda o modelo descrever.
 * A busca web automática entra quando houver um provedor de busca configurado.
 */

const LIMITE_TEXTO = 20_000;

/** Baixa uma página e devolve o texto visível, sem scripts, estilos e tags. */
export async function lerPagina(url: string): Promise<{ titulo: string | null; texto: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CommandCenterRadar/1.0)" },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao ler ${url}`);

  const html = await res.text();
  const titulo = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;

  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, LIMITE_TEXTO);

  return { titulo, texto };
}

/**
 * Registra uma fonte a partir de uma URL e pede ao Radar que a descreva.
 * URL repetida não cria fonte nova.
 */
export async function radarLerUrl(url: string): Promise<{ fonteId: string; nova: boolean }> {
  const limpa = url.trim();
  const existente = await prisma.fonteConteudo.findFirst({ where: { url: limpa } });
  if (existente) return { fonteId: existente.id, nova: false };

  const { titulo, texto } = await lerPagina(limpa);
  if (texto.length < 200) throw new Error("A página veio quase vazia — pode exigir login ou ser só imagem.");

  const fonte = await prisma.fonteConteudo.create({
    data: { url: limpa, titulo, conteudoBruto: texto, origem: "MANUAL" },
  });

  await radarResumirFonte(fonte.id);
  return { fonteId: fonte.id, nova: true };
}

/** Uma fonte sem URL: você digita o tema/ângulo e a máquina trata como origem INTERNA. */
export async function radarRegistrarTema(tema: string, contexto: string): Promise<string> {
  const fonte = await prisma.fonteConteudo.create({
    data: {
      url: `interno:${Date.now()}`,
      titulo: tema,
      tema,
      plataforma: "outro",
      formato: "outro",
      resumo: contexto,
      porQueFunciona: "Tema levantado pelo Luiz — vem da operação real, não de tendência.",
      conteudoBruto: `${tema}\n\n${contexto}`,
      origem: "INTERNO",
    },
  });
  return fonte.id;
}
