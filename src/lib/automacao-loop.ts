/**
 * Detecta a regra que responde a si mesma. Pura — sem banco, sem rede.
 *
 * Em 22/10/2026 uma regra com palavra-chave "EDIÇÃO" tinha como resposta
 * pública "Mandei o passo a passo do seu estúdio de edição com IA no direct".
 * A resposta é um comentário novo no mesmo post, casa com a própria regra, e a
 * automação respondeu a si mesma 13 vezes em 33 segundos.
 *
 * O webhook já ignora comentários da própria conta, o que fecha o buraco. Isto
 * aqui é o aviso antes: a tela mostra o risco enquanto a regra está sendo
 * escrita, para o problema nem chegar a existir.
 */

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function palavras(keywords: string): string[] {
  return keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Quais palavras-chave aparecem no texto que a automação envia de volta.
 * Vazio = a regra não se alimenta.
 */
export function palavrasQueRetornam(keywords: string, textoDeResposta: string): string[] {
  const alvo = normalizar(textoDeResposta);
  if (!alvo.trim()) return [];
  return palavras(keywords).filter((k) => {
    const n = normalizar(k);
    return n.length > 0 && alvo.includes(n);
  });
}

export interface AvisoLoop {
  risco: boolean;
  palavras: string[];
  mensagem: string;
}

/**
 * `replyText` é o que vira comentário público — é o único que fecha o ciclo.
 * O texto de DM não aparece como comentário, então não realimenta a regra.
 */
export function avaliarLoop(regra: { keywords: string; replyText: string }): AvisoLoop {
  const achadas = palavrasQueRetornam(regra.keywords, regra.replyText);
  if (!achadas.length) return { risco: false, palavras: [], mensagem: "" };

  const lista = achadas.map((p) => `"${p}"`).join(", ");
  return {
    risco: true,
    palavras: achadas,
    mensagem:
      achadas.length === 1
        ? `A resposta pública contém ${lista}, que é palavra-chave desta regra. Troque a palavra na resposta — senão ela tende a reagir ao próprio texto.`
        : `A resposta pública contém ${lista}, que são palavras-chave desta regra. Troque-as na resposta — senão ela tende a reagir ao próprio texto.`,
  };
}
