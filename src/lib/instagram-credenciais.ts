import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DIAS_TOKEN,
  diasAte,
  expirado,
  precisaAlertar,
  precisaRenovar,
} from "@/lib/instagram-token";

export { DIAS_TOKEN, DIAS_PARA_RENOVAR, DIAS_PARA_ALERTAR, diasAte } from "@/lib/instagram-token";

/**
 * De onde vem o token do Instagram.
 *
 * Ele mora no banco. O .env continua valendo como reserva — é o que mantém o
 * desenvolvimento local funcionando e o que salvou o sistema enquanto o token
 * vivia só lá —, mas quem manda é o banco: na Vercel o disco é efêmero, então
 * gravar em arquivo nunca persistiu nada.
 *
 * Tokens de longa duração do Instagram duram 60 dias. Um token expirado NÃO
 * pode ser renovado: tem que refazer a autorização. Por isso o cron renova aos
 * 30 dias e o alerta aparece faltando 7 — a janela de conserto nunca fecha
 * sozinha.
 */

const strip = (v?: string | null) => (v ?? "").replace(/^﻿/, "").trim();

export interface Credenciais {
  token: string;
  userId: string;
  origem: "banco" | "env" | "nenhum";
  expiraEm: Date | null;
}

/**
 * Cache por instância. O Fluid Compute reusa processos, então sem isso cada
 * resposta de webhook faria uma leitura a mais no banco. TTL curto para que um
 * token recém-renovado circule rápido.
 */
let cache: { valor: Credenciais; em: number } | null = null;
const TTL_MS = 60_000;

export async function credenciais(forcar = false): Promise<Credenciais> {
  if (!forcar && cache && Date.now() - cache.em < TTL_MS) return cache.valor;

  const cfg = await prisma.config
    .findUnique({
      where: { id: "singleton" },
      select: { igAccessToken: true, igUserId: true, igTokenExpiraEm: true },
    })
    .catch(() => null);

  const doBanco = strip(cfg?.igAccessToken);
  const valor: Credenciais = doBanco
    ? {
        token: doBanco,
        userId: strip(cfg?.igUserId) || strip(process.env.IG_USER_ID),
        origem: "banco",
        expiraEm: cfg?.igTokenExpiraEm ?? null,
      }
    : {
        token: strip(process.env.IG_ACCESS_TOKEN),
        userId: strip(process.env.IG_USER_ID),
        origem: strip(process.env.IG_ACCESS_TOKEN) ? "env" : "nenhum",
        expiraEm: null,
      };

  cache = { valor, em: Date.now() };
  return valor;
}

/** Token e userId para uma chamada à Graph API. Vazios se não houver integração. */
export async function tokenAtual(): Promise<{ token: string; userId: string }> {
  const c = await credenciais();
  return { token: c.token, userId: c.userId };
}

export async function integracaoConfigurada(): Promise<boolean> {
  const c = await credenciais();
  return Boolean(c.token && c.userId);
}

export async function salvarCredenciais(dados: {
  token: string;
  userId?: string;
  /** segundos até expirar, como o Instagram devolve */
  expiraEmSegundos?: number;
}): Promise<void> {
  const expiraEm = dados.expiraEmSegundos
    ? new Date(Date.now() + dados.expiraEmSegundos * 1000)
    : new Date(Date.now() + DIAS_TOKEN * 86_400_000);

  await prisma.config.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      igAccessToken: dados.token,
      igUserId: dados.userId ?? null,
      igTokenExpiraEm: expiraEm,
      igTokenRenovadoEm: new Date(),
    },
    update: {
      igAccessToken: dados.token,
      ...(dados.userId ? { igUserId: dados.userId } : {}),
      igTokenExpiraEm: expiraEm,
      igTokenRenovadoEm: new Date(),
    },
  });
  cache = null;
}

/**
 * A Graph API recusou o token (erro 190). Registrado para que um token morto
 * apareça no Hoje mesmo quando não se conhece a data de validade — foi
 * exatamente assim que ele expirou calado em outubro de 2026.
 */
export async function marcarTokenInvalido(): Promise<void> {
  const cfg = await prisma.config
    .findUnique({ where: { id: "singleton" }, select: { igTokenInvalidoEm: true } })
    .catch(() => null);
  if (cfg?.igTokenInvalidoEm) return; // já marcado: não reescreve a cada tentativa

  await prisma.config
    .upsert({
      where: { id: "singleton" },
      create: { id: "singleton", igTokenInvalidoEm: new Date() },
      update: { igTokenInvalidoEm: new Date() },
    })
    .catch(() => {});
  cache = null;
}

/** Uma chamada deu certo: o token voltou a valer. */
export async function marcarTokenValido(): Promise<void> {
  const cfg = await prisma.config
    .findUnique({ where: { id: "singleton" }, select: { igTokenInvalidoEm: true } })
    .catch(() => null);
  if (!cfg?.igTokenInvalidoEm) return;

  await prisma.config
    .update({ where: { id: "singleton" }, data: { igTokenInvalidoEm: null } })
    .catch(() => {});
  cache = null;
}

export interface StatusToken {
  configurado: boolean;
  origem: Credenciais["origem"];
  expiraEm: string | null;
  diasRestantes: number | null;
  /** A Graph API recusou o token desde esta data. */
  recusadoDesde: string | null;
  expirado: boolean;
  precisaRenovar: boolean;
  precisaAlertar: boolean;
}

export async function statusToken(agora = new Date()): Promise<StatusToken> {
  const c = await credenciais();
  const dias = diasAte(c.expiraEm, agora);
  const cfg = await prisma.config
    .findUnique({ where: { id: "singleton" }, select: { igTokenInvalidoEm: true } })
    .catch(() => null);
  const recusado = cfg?.igTokenInvalidoEm ?? null;

  return {
    configurado: Boolean(c.token && c.userId),
    origem: c.origem,
    expiraEm: c.expiraEm?.toISOString() ?? null,
    diasRestantes: dias,
    recusadoDesde: recusado?.toISOString() ?? null,
    // Sem data conhecida a validade não diz nada, mas uma recusa diz tudo.
    expirado: expirado(dias) || recusado !== null,
    precisaRenovar: precisaRenovar(dias),
    precisaAlertar: precisaAlertar(dias),
  };
}

export type ResultadoRenovacao =
  | { ok: true; diasRestantes: number; renovado: true }
  | { ok: true; renovado: false; motivo: string }
  | { ok: false; erro: string; precisaReconectar: boolean };

/**
 * Renova o token por mais 60 dias via ig_refresh_token.
 *
 * O Instagram exige um token vivo e com mais de 24 horas. Token expirado não
 * tem conserto por aqui — só reconectando, e é isso que o retorno diz.
 */
export async function renovarToken(forcar = false): Promise<ResultadoRenovacao> {
  const c = await credenciais(true);
  if (!c.token) {
    return { ok: false, erro: "Sem token configurado.", precisaReconectar: true };
  }

  const dias = diasAte(c.expiraEm);
  if (dias !== null && expirado(dias)) {
    return {
      ok: false,
      erro: `Token expirou ${dias === 0 ? "hoje" : `há ${-dias} dia(s)`}. Reconecte a conta — token expirado não pode ser renovado.`,
      precisaReconectar: true,
    };
  }
  if (!forcar && dias !== null && !precisaRenovar(dias)) {
    return { ok: true, renovado: false, motivo: `Ainda faltam ${dias} dias; renova a partir de ${DIAS_TOKEN - 30}.` };
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", c.token);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const dados = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; code?: number };
  };

  if (!res.ok || !dados.access_token) {
    const msg = dados.error?.message ?? `HTTP ${res.status}`;
    // 190 é token inválido/expirado: não adianta tentar de novo, só reconectando.
    return { ok: false, erro: msg, precisaReconectar: dados.error?.code === 190 };
  }

  await salvarCredenciais({
    token: dados.access_token,
    userId: c.userId || undefined,
    expiraEmSegundos: dados.expires_in,
  });

  return { ok: true, renovado: true, diasRestantes: Math.round((dados.expires_in ?? DIAS_TOKEN * 86_400) / 86_400) };
}
