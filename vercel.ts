import type { VercelConfig } from "@vercel/config/v1";

/**
 * Configuração do projeto na Vercel.
 *
 * O cron existe por um motivo concreto: o token do Instagram dura 60 dias e,
 * em outubro de 2026, expirou em silêncio — as automações pararam de responder
 * e nada avisou. A rota renova a partir dos 30 dias de uso; rodar todo dia é
 * barato e garante que uma falha isolada não acumule atraso.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      path: "/api/instagram/token",
      schedule: "0 9 * * *",
    },
    {
      // 05:00 UTC = 02:00 em Brasília. De madrugada o Apify responde mais
      // rápido e o resultado está pronto quando você abre o painel.
      path: "/api/radar/rodar",
      schedule: "0 5 * * *",
    },
    {
      // Rede de segurança: fecha rodadas que ficaram penduradas sem o webhook.
      path: "/api/radar/coletar",
      schedule: "30 5,6 * * *",
    },
  ],
};

export default config;
