/**
 * Adiciona createLead e leadLinha à tabela AutoRule.
 * Uso: npx tsx prisma/migrate-fase3.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const SQL = [
  // SQLite só aceita ADD COLUMN um por vez
  `ALTER TABLE "AutoRule" ADD COLUMN "createLead" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "AutoRule" ADD COLUMN "leadLinha" TEXT`,
];

async function run() {
  for (const sql of SQL) {
    try {
      await client.execute(sql);
      console.log("✓", sql.slice(0, 70));
    } catch (e: unknown) {
      // Coluna já existe — idempotente
      const msg = (e as Error).message ?? "";
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        console.log("↩ coluna já existe, pulando:", sql.slice(0, 60));
      } else {
        throw e;
      }
    }
  }
  console.log("\nMigração concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
