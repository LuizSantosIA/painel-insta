/**
 * Adiciona ultimoContatoEm e saudeNota à tabela Client.
 * Uso: npx tsx prisma/migrate-saude.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const SQL = [
  `ALTER TABLE "Client" ADD COLUMN "ultimoContatoEm" DATETIME`,
  `ALTER TABLE "Client" ADD COLUMN "saudeNota" TEXT`,
];

async function run() {
  for (const sql of SQL) {
    try {
      await client.execute(sql);
      console.log("✓", sql.slice(0, 70));
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        console.log("↩ coluna já existe, pulando");
      } else {
        throw e;
      }
    }
  }
  console.log("\nMigração concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
