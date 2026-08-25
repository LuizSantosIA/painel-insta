/**
 * Pipeline operacional: registra desde quando a oportunidade está no estágio atual
 * e guarda o motivo quando ela é perdida.
 *
 * Aditivo. `estagioDesde` nasce NULL nos leads existentes de propósito — não dá
 * para saber quando eles entraram no estágio atual, e inventar essa data faria a
 * tela mentir sobre há quanto tempo a negociação está parada.
 *
 * Uso: npx tsx prisma/migrate-pipeline-oportunidade.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const COLUNAS = [
  `ALTER TABLE "Lead" ADD COLUMN "estagioDesde" DATETIME`,
  `ALTER TABLE "Lead" ADD COLUMN "motivoPerda" TEXT`,
  `ALTER TABLE "Lead" ADD COLUMN "notaPerda" TEXT`,
];

async function run() {
  for (const sql of COLUNAS) {
    const nome = sql.match(/ADD COLUMN "(\w+)"/)?.[1] ?? sql;
    try {
      await client.execute(sql);
      console.log("✓ Lead." + nome);
    } catch (e) {
      const msg = (e as Error).message;
      if (/duplicate column/i.test(msg)) console.log("· Lead." + nome + " já existe");
      else throw e;
    }
  }

  const pendentes = await client.execute(
    `SELECT COUNT(*) AS n FROM "Lead" WHERE "estagioDesde" IS NULL`
  );
  console.log(
    `\n${pendentes.rows[0].n} oportunidade(s) sem estagioDesde — o contador de tempo parado` +
      `\ncomeça a valer para elas na próxima mudança de estágio.`
  );

  console.log("\nMigração do pipeline concluída.");
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
