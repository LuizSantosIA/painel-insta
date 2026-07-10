/**
 * Cria as tabelas do módulo Financeiro diretamente via @libsql/client.
 * Uso: npx tsx prisma/migrate-financeiro.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const SQL = [
  `CREATE TABLE IF NOT EXISTS "Receita" (
    "id"            TEXT     NOT NULL PRIMARY KEY,
    "descricao"     TEXT     NOT NULL,
    "valorCentavos" INTEGER  NOT NULL,
    "linha"         TEXT     NOT NULL,
    "tipo"          TEXT     NOT NULL,
    "status"        TEXT     NOT NULL DEFAULT 'PREVISTA',
    "clienteId"     TEXT,
    "competencia"   DATETIME NOT NULL,
    "dataRecebida"  DATETIME,
    "criadoEm"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE SET NULL
  )`,

  `CREATE INDEX IF NOT EXISTS "Receita_competencia_status_idx"
     ON "Receita"("competencia","status")`,

  `CREATE INDEX IF NOT EXISTS "Receita_linha_idx"
     ON "Receita"("linha")`,

  `CREATE TABLE IF NOT EXISTS "Despesa" (
    "id"            TEXT     NOT NULL PRIMARY KEY,
    "descricao"     TEXT     NOT NULL,
    "valorCentavos" INTEGER  NOT NULL,
    "recorrente"    INTEGER  NOT NULL DEFAULT 0,
    "competencia"   DATETIME NOT NULL,
    "criadoEm"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "Despesa_competencia_idx"
     ON "Despesa"("competencia")`,

  `CREATE TABLE IF NOT EXISTS "Config" (
    "id"           TEXT     NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "saldoCaixa"   INTEGER  NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

async function run() {
  for (const sql of SQL) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 60));
  }
  console.log("\nMigração concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
