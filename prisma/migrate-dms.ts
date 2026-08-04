/**
 * Cria as tabelas IgConversation e IgMessage para o inbox de DMs.
 * Uso: npx tsx prisma/migrate-dms.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const SQL = [
  `CREATE TABLE IF NOT EXISTS "IgConversation" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "igUserId"    TEXT     NOT NULL DEFAULT '',
    "igUsername"  TEXT     NOT NULL DEFAULT '',
    "updatedAt"   DATETIME NOT NULL,
    "syncedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "IgConversation_updatedAt_idx"
     ON "IgConversation"("updatedAt")`,

  `CREATE TABLE IF NOT EXISTS "IgMessage" (
    "id"             TEXT     NOT NULL PRIMARY KEY,
    "conversationId" TEXT     NOT NULL,
    "text"           TEXT     NOT NULL DEFAULT '',
    "fromMe"         INTEGER  NOT NULL DEFAULT 0,
    "fromUsername"   TEXT     NOT NULL DEFAULT '',
    "createdAt"      DATETIME NOT NULL,
    "syncedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("conversationId") REFERENCES "IgConversation"("id") ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "IgMessage_conversationId_createdAt_idx"
     ON "IgMessage"("conversationId","createdAt")`,
];

async function run() {
  for (const sql of SQL) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 70));
  }
  console.log("\nMigração DMs concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
