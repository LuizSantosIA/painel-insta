/**
 * Token do Instagram sai do .env e passa a morar no banco.
 *
 * Motivo: na Vercel o disco é efêmero e somente leitura, então o fluxo de
 * reconexão — que gravava o token no arquivo .env — nunca funcionou em
 * produção. No banco, reconectar pelo painel passa a valer de verdade, e o
 * cron consegue renovar o token sozinho antes dos 60 dias.
 *
 * Aditivo: só acrescenta colunas em Config. Nada é apagado, e o .env continua
 * valendo como reserva enquanto o banco estiver vazio.
 *
 * Uso: npx tsx prisma/migrate-token-instagram.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const COLUNAS = [
  `ALTER TABLE "Config" ADD COLUMN "igAccessToken" TEXT`,
  `ALTER TABLE "Config" ADD COLUMN "igUserId" TEXT`,
  `ALTER TABLE "Config" ADD COLUMN "igTokenExpiraEm" DATETIME`,
  `ALTER TABLE "Config" ADD COLUMN "igTokenRenovadoEm" DATETIME`,
  `ALTER TABLE "Config" ADD COLUMN "igTokenInvalidoEm" DATETIME`,
];

async function run() {
  console.log("Token do Instagram → banco\n");

  for (const sql of COLUNAS) {
    const coluna = sql.match(/ADD COLUMN "(\w+)"/)?.[1] ?? sql;
    try {
      await client.execute(sql);
      console.log(`✓ Config.${coluna}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate column/i.test(msg)) console.log(`· Config.${coluna} já existia`);
      else throw e;
    }
  }

  // Garante que a linha singleton existe — o painel assume que sim.
  await client.execute(
    `INSERT OR IGNORE INTO "Config" (id, saldoCaixa, atualizadoEm) VALUES ('singleton', 0, CURRENT_TIMESTAMP)`
  );

  const cfg = await client.execute(`SELECT igAccessToken, igUserId, igTokenExpiraEm FROM "Config" WHERE id = 'singleton'`);
  const linha = cfg.rows[0];
  if (linha?.igAccessToken) {
    console.log(`\n· Já existe token no banco (expira ${linha.igTokenExpiraEm ?? "sem data"}).`);
  } else {
    console.log("\n· Banco ainda sem token — o do .env continua valendo como reserva.");
    console.log("  Reconecte pelo painel (/maquina/integracoes) para gravar o novo aqui.");
  }

  console.log("\nMigração concluída.");
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
