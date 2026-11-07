import "server-only";
import { env } from "@/lib/env";

/**
 * Cliente do Apify — só o necessário, sem SDK.
 *
 * As rodadas são assíncronas de propósito: um actor de Google Maps leva
 * minutos, e a função da Vercel morre em 300s. Então iniciamos a rodada,
 * guardamos o runId e voltamos depois pelo webhook (ou pelo cron de varredura).
 * Nada aqui fica esperando o Apify terminar.
 */

const BASE = "https://api.apify.com/v2";

export class ApifySemToken extends Error {
  constructor() {
    super("APIFY_TOKEN não configurado.");
    this.name = "ApifySemToken";
  }
}

function token(): string {
  const t = env("APIFY_TOKEN");
  if (!t) throw new ApifySemToken();
  return t;
}

export function apifyConfigurado(): boolean {
  return Boolean(env("APIFY_TOKEN"));
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...init?.headers },
    cache: "no-store",
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (corpo as { error?: { message?: string } })?.error?.message ?? `HTTP ${r.status}`;
    throw new Error(`Apify: ${msg}`);
  }
  return corpo as T;
}

export type StatusRun =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "ABORTING"
  | "ABORTED"
  | "TIMING-OUT"
  | "TIMED-OUT";

export interface RunApify {
  id: string;
  status: StatusRun;
  defaultDatasetId: string;
  startedAt?: string;
  finishedAt?: string;
  usageTotalUsd?: number;
}

/** O actor terminou, de qualquer jeito? */
export function runTerminou(status: StatusRun): boolean {
  return ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status);
}

export function runDeuCerto(status: StatusRun): boolean {
  return status === "SUCCEEDED";
}

/** Dispara o actor e volta na hora, sem esperar. O id é o que liga a execução. */
export async function iniciarRun(
  actor: string,
  input: Record<string, unknown>,
  webhookUrl?: string
): Promise<RunApify> {
  const params = new URLSearchParams();
  if (webhookUrl) {
    // O Apify avisa quando terminar, em vez de ficarmos pesquisando.
    params.set(
      "webhooks",
      Buffer.from(
        JSON.stringify([
          {
            eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
            requestUrl: webhookUrl,
          },
        ])
      ).toString("base64")
    );
  }

  const qs = params.toString();
  const { data } = await chamar<{ data: RunApify }>(
    `/acts/${actor.replace("/", "~")}/runs${qs ? `?${qs}` : ""}`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return data;
}

export async function statusRun(runId: string): Promise<RunApify> {
  const { data } = await chamar<{ data: RunApify }>(`/actor-runs/${runId}`);
  return data;
}

/** Itens do dataset. Paginado porque uma busca ampla passa de 1000 linhas. */
export async function lerDataset<T>(datasetId: string, limite = 1000): Promise<T[]> {
  const itens: T[] = [];
  let offset = 0;

  while (itens.length < limite) {
    const pagina = await chamar<T[]>(
      `/datasets/${datasetId}/items?clean=true&format=json&limit=${Math.min(250, limite - itens.length)}&offset=${offset}`
    );
    if (!Array.isArray(pagina) || pagina.length === 0) break;
    itens.push(...pagina);
    offset += pagina.length;
    if (pagina.length < 250) break;
  }

  return itens;
}

/** Custo da rodada em centavos de real. Aproximado: o Apify cobra em dólar. */
export function custoEmCentavos(usd: number | undefined, cotacao = 5.5): number {
  return Math.round((usd ?? 0) * cotacao * 100);
}
