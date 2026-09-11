import "server-only";
import { generateText, Output } from "ai";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Agente, Etapa } from "./etapas";

/**
 * Executor de agentes.
 *
 * Toda chamada de modelo passa por aqui, e cada uma vira uma linha em
 * ExecucaoAgente — com o prompt exato, o modelo, os tokens e o erro. É o que
 * responde "quem criou isso, com que prompt e por quê".
 *
 * O modelo vai como string do AI Gateway ("anthropic/claude-sonnet-5"); trocar
 * de provedor é trocar a string, sem mexer em agente nenhum.
 */

/** Modelo padrão. Sonnet 5 cobre copy em português com boa relação custo/qualidade. */
export const MODELO_PADRAO = process.env.ENGINE_MODELO ?? "anthropic/claude-sonnet-5";

/** Modelo para as decisões que mais pesam: estratégia e copy final. */
export const MODELO_FORTE = process.env.ENGINE_MODELO_FORTE ?? MODELO_PADRAO;

export class TetoAtingidoError extends Error {
  constructor(usadas: number, teto: number) {
    super(`Teto diário da máquina atingido: ${usadas}/${teto} execuções.`);
    this.name = "TetoAtingidoError";
  }
}

/** Execuções desde a meia-noite (UTC). A trava está no banco, não na memória. */
export async function execucoesHoje(): Promise<{ usadas: number; teto: number }> {
  const inicio = new Date();
  inicio.setUTCHours(0, 0, 0, 0);
  const [usadas, config] = await Promise.all([
    prisma.execucaoAgente.count({ where: { criadoEm: { gte: inicio } } }),
    prisma.config.findUnique({ where: { id: "singleton" }, select: { tetoExecucoesDia: true } }),
  ]);
  return { usadas, teto: config?.tetoExecucoesDia ?? 60 };
}

export interface ChamadaAgente<S extends z.ZodTypeAny> {
  agente: Agente;
  etapa?: Etapa;
  postId?: string | null;
  slideOrdem?: number | null;
  modelo?: string;
  /** Quem o agente é e como deve se comportar. */
  system: string;
  /** A tarefa concreta desta execução. */
  prompt: string;
  /** O formato obrigatório da resposta. */
  schema: S;
  /** O que entrou, para o log — só o que importa, não o prompt inteiro de novo. */
  entrada?: unknown;
}

export interface ResultadoAgente<T> {
  saida: T;
  execucaoId: string;
  tokensIn: number;
  tokensOut: number;
  duracaoMs: number;
}

/** Mensagem de erro sem códigos ANSI de cor (o Gateway colore a saída) e num tamanho que cabe na tela. */
export function limparErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0].trim().slice(0, 300);
}

/**
 * Roda um agente com saída estruturada e grava a execução — sucesso ou erro.
 * Estoura TetoAtingidoError antes de gastar um token se o dia já passou do limite.
 */
export async function executarAgente<S extends z.ZodTypeAny>(
  chamada: ChamadaAgente<S>
): Promise<ResultadoAgente<z.infer<S>>> {
  const { usadas, teto } = await execucoesHoje();
  if (usadas >= teto) throw new TetoAtingidoError(usadas, teto);

  const modelo = chamada.modelo ?? MODELO_PADRAO;
  const inicio = Date.now();

  try {
    const resultado = await generateText({
      model: modelo,
      system: chamada.system,
      prompt: chamada.prompt,
      output: Output.object({ schema: chamada.schema }),
    });

    const duracaoMs = Date.now() - inicio;
    const tokensIn = resultado.usage.inputTokens ?? 0;
    const tokensOut = resultado.usage.outputTokens ?? 0;
    const saida = resultado.output as z.infer<S>;

    const execucao = await prisma.execucaoAgente.create({
      data: {
        postId: chamada.postId ?? null,
        slideOrdem: chamada.slideOrdem ?? null,
        agente: chamada.agente,
        etapa: chamada.etapa ?? null,
        status: "OK",
        entrada: JSON.stringify(chamada.entrada ?? {}),
        saida: JSON.stringify(saida),
        prompt: `${chamada.system}\n\n---\n\n${chamada.prompt}`,
        modelo,
        tokensIn,
        tokensOut,
        duracaoMs,
      },
    });

    return { saida, execucaoId: execucao.id, tokensIn, tokensOut, duracaoMs };
  } catch (e) {
    const erro = limparErro(e);
    await prisma.execucaoAgente.create({
      data: {
        postId: chamada.postId ?? null,
        slideOrdem: chamada.slideOrdem ?? null,
        agente: chamada.agente,
        etapa: chamada.etapa ?? null,
        status: "ERRO",
        entrada: JSON.stringify(chamada.entrada ?? {}),
        prompt: `${chamada.system}\n\n---\n\n${chamada.prompt}`,
        modelo,
        duracaoMs: Date.now() - inicio,
        erro,
      },
    });
    throw e;
  }
}

/**
 * Registra uma execução que não passou por modelo (render de slide, publicação,
 * coleta de métricas). Mantém a trilha completa mesmo para o que é determinístico.
 */
export async function registrarExecucao(dados: {
  agente: Agente;
  etapa?: Etapa;
  postId?: string | null;
  slideOrdem?: number | null;
  status?: "OK" | "ERRO" | "ALERTA";
  entrada?: unknown;
  saida?: unknown;
  duracaoMs?: number;
  erro?: string;
}): Promise<string> {
  const e = await prisma.execucaoAgente.create({
    data: {
      postId: dados.postId ?? null,
      slideOrdem: dados.slideOrdem ?? null,
      agente: dados.agente,
      etapa: dados.etapa ?? null,
      status: dados.status ?? "OK",
      entrada: JSON.stringify(dados.entrada ?? {}),
      saida: JSON.stringify(dados.saida ?? {}),
      modelo: "—",
      duracaoMs: dados.duracaoMs ?? 0,
      erro: dados.erro ?? null,
    },
  });
  return e.id;
}
