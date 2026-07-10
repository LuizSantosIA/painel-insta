/**
 * Cria a tabela Lead diretamente via @libsql/client.
 * Uso: npx tsx prisma/migrate-pipeline.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const SQL = [
  `CREATE TABLE IF NOT EXISTS "Lead" (
    "id"                    TEXT     NOT NULL PRIMARY KEY,
    "nome"                  TEXT     NOT NULL,
    "contato"               TEXT     NOT NULL,
    "estagio"               TEXT     NOT NULL DEFAULT 'LEAD',
    "origem"                TEXT     NOT NULL,
    "linhaInteresse"        TEXT     NOT NULL,
    "valorEstimadoCentavos" INTEGER,
    "proximaAcao"           TEXT,
    "proximaAcaoEm"         DATETIME,
    "postOrigemId"          TEXT,
    "notas"                 TEXT,
    "criadoEm"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "Lead_estagio_proximaAcaoEm_idx"
     ON "Lead"("estagio","proximaAcaoEm")`,
];

async function run() {
  for (const sql of SQL) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 70));
  }
  console.log("\nMigração concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
