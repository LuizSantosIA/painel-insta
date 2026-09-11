import "server-only";
import { prisma } from "@/lib/prisma";
import type { AlertaNegocio } from "@/lib/negocio-overview";

/**
 * Sinais da máquina de conteúdo para o Hoje. Mesmo tipo AlertaNegocio das outras
 * engines — o Hoje só prioriza. Só entra o que pede uma decisão sua.
 */
export async function alertasEngine(): Promise<AlertaNegocio[]> {
  const [aguardando, comErro, agendadosVencidos] = await Promise.all([
    prisma.post.count({ where: { etapa: "AGUARDANDO_APROVACAO" } }),
    prisma.post.findMany({
      where: { etapa: { in: ["SELECIONADA", "COPY", "DESIGN", "REVISAO"] } },
      select: { id: true, tituloInterno: true, execucoes: { where: { status: "ERRO" }, orderBy: { criadoEm: "desc" }, take: 1, select: { erro: true } } },
    }),
    prisma.post.count({ where: { etapa: "AGENDADO", agendadoPara: { lt: new Date() } } }),
  ]);

  const alertas: AlertaNegocio[] = [];

  if (aguardando > 0) {
    alertas.push({
      id: "engine-aprovacao",
      titulo: `${aguardando} ${aguardando === 1 ? "post aguardando" : "posts aguardando"} sua aprovação`,
      detalhe: "a máquina terminou; só falta você",
      severidade: "ATENCAO",
      destino: "/maquina/engine",
      destinoLabel: "Máquina",
      peso: aguardando,
    });
  }

  for (const p of comErro) {
    if (!p.execucoes[0]) continue;
    alertas.push({
      id: `engine-erro-${p.id}`,
      titulo: p.tituloInterno ?? "Post da máquina",
      detalhe: `travou na produção · ${p.execucoes[0].erro?.slice(0, 80) ?? "erro"}`,
      severidade: "ATENCAO",
      destino: `/maquina/engine/${p.id}`,
      destinoLabel: "Máquina",
      peso: 2,
    });
  }

  if (agendadosVencidos > 0) {
    alertas.push({
      id: "engine-agendado-vencido",
      titulo: `${agendadosVencidos} ${agendadosVencidos === 1 ? "post agendado passou" : "posts agendados passaram"} do horário`,
      detalhe: "publique agora ou reagende",
      severidade: "URGENTE",
      destino: "/maquina/engine",
      destinoLabel: "Máquina",
      peso: agendadosVencidos,
    });
  }

  return alertas;
}
