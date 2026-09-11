import "server-only";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { limparErro, registrarExecucao } from "./ia";
import { parsePaleta, renderizarSlide } from "./render/slide";

/**
 * GERADOR VISUAL: um arquivo por slide, nunca uma imagem com todos.
 *
 * Renderiza o template do estilo e sobe para o Blob (URL pública — o Instagram só
 * publica a partir de URL acessível). Cada slide vira uma execução registrada.
 */

export function blobConfigurado(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Gera os slides de um post. `apenas` limita a ordens específicas — é o que faz
 * "não gostei do slide 3" refazer só o slide 3.
 */
export async function gerarSlides(postId: string, apenas?: number[]): Promise<{ gerados: number; erros: number }> {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { slides: { orderBy: { ordem: "asc" } }, estiloVisual: true },
  });

  if (!post.estiloVisual) throw new Error("Post sem estilo visual — o Diretor Visual precisa rodar antes.");
  if (!blobConfigurado()) throw new Error("BLOB_READ_WRITE_TOKEN ausente — sem storage não há onde guardar o slide.");

  const estilo = {
    chave: post.estiloVisual.chave,
    paleta: parsePaleta(post.estiloVisual.paleta),
    usaAsset: post.estiloVisual.usaAsset,
  };

  const alvo = apenas ? post.slides.filter((s) => apenas.includes(s.ordem)) : post.slides;
  let gerados = 0;
  let erros = 0;

  for (const slide of alvo) {
    const inicio = Date.now();
    try {
      const png = await renderizarSlide(
        {
          ordem: slide.ordem,
          total: post.slides.length,
          headline: slide.headline,
          corpo: slide.corpo,
          microcopy: slide.microcopy,
          layout: slide.layout,
          assetUrl: slide.assetUrl,
        },
        estilo
      );

      const { url } = await put(`engine/${postId}/slide-${slide.ordem}-v${slide.versao}.png`, png, {
        access: "public",
        contentType: "image/png",
        addRandomSuffix: true,
      });

      await prisma.postSlide.update({ where: { id: slide.id }, data: { imagemUrl: url } });
      await registrarExecucao({
        agente: "GERADOR",
        etapa: "COPY",
        postId,
        slideOrdem: slide.ordem,
        entrada: { layout: slide.layout, estilo: estilo.chave, versao: slide.versao },
        saida: { url, bytes: png.byteLength },
        duracaoMs: Date.now() - inicio,
      });
      gerados++;
    } catch (e) {
      erros++;
      await registrarExecucao({
        agente: "GERADOR",
        etapa: "COPY",
        postId,
        slideOrdem: slide.ordem,
        status: "ERRO",
        entrada: { layout: slide.layout, estilo: estilo.chave },
        duracaoMs: Date.now() - inicio,
        erro: limparErro(e),
      });
    }
  }

  return { gerados, erros };
}
