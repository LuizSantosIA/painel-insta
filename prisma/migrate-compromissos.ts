/**
 * Cria a tabela Compromisso diretamente via @libsql/client.
 * Uso: npx tsx prisma/migrate-compromissos.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const SQL = [
  `CREATE TABLE IF NOT EXISTS "Compromisso" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "descricao"    TEXT     NOT NULL,
    "para"         TEXT     NOT NULL,
    "prazoEm"      DATETIME NOT NULL,
    "cumprido"     INTEGER  NOT NULL DEFAULT 0,
    "cumpridoEm"   DATETIME,
    "notas"        TEXT,
    "criadoEm"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "Compromisso_cumprido_prazoEm_idx"
     ON "Compromisso"("cumprido","prazoEm")`,
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
