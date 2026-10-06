/**
 * Leitura de variável de ambiente sem lixo invisível.
 *
 * Variáveis coladas de um editor ou gravadas por um terminal chegam com BOM
 * (U+FEFF) ou com espaço e quebra de linha nas pontas. Isso é invisível em
 * qualquer painel e quebra as coisas longe daqui: em outubro de 2026 o BOM foi
 * parar dentro da URL de autorização do Instagram (`client_id=%EF%BB%BF...`) e
 * a conta simplesmente não conectava, sem nenhuma mensagem útil.
 *
 * Toda leitura de env que vai virar URL, header ou segredo deve passar por aqui.
 */
export function env(nome: string, padrao = ""): string {
  return limpar(process.env[nome]) || padrao;
}

/** Primeira das variáveis que tiver valor. Para pares legados tipo NOVO ?? ANTIGO. */
export function envAlgum(...nomes: string[]): string {
  for (const n of nomes) {
    const v = limpar(process.env[n]);
    if (v) return v;
  }
  return "";
}

/** Tira BOM, espaços e quebras de linha das pontas. */
export function limpar(valor?: string | null): string {
  return (valor ?? "").replace(/^﻿/, "").trim();
}

/** URL base da aplicação, sem barra no fim. */
export function urlBase(): string {
  return (env("APP_URL") || "http://localhost:3000").replace(/\/+$/, "");
}
