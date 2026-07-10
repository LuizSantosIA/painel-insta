/**
 * Cria a tabela PostRascunho para o sistema de auto posts.
 * Uso: npx tsx prisma/migrate-gerador.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const SQL = [
  `CREATE TABLE IF NOT EXISTS "PostRascunho" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "topico"       TEXT     NOT NULL,
    "slides"       TEXT     NOT NULL,
    "legenda"      TEXT     NOT NULL,
    "status"       TEXT     NOT NULL DEFAULT 'RASCUNHO',
    "igMediaId"    TEXT,
    "geradoEm"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "PostRascunho_status_geradoEm_idx"
     ON "PostRascunho"("status","geradoEm")`,
];

async function run() {
  for (const sql of SQL) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 70));
  }
  console.log("\nMigração PostRascunho concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
