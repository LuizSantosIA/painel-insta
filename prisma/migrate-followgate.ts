/**
 * Trava de seguidor ("siga para liberar o link"):
 *  - novas colunas em AutoRule (gatilho + campos do gate)
 *  - tabelas FollowGate (estado por pessoa+regra) e DmEvent (idempotência de webhook)
 *
 * Uso: npx tsx prisma/migrate-followgate.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

// SQLite não tem ADD COLUMN IF NOT EXISTS — rodamos uma a uma e ignoramos "duplicate column".
const COLUNAS = [
  `ALTER TABLE "AutoRule" ADD COLUMN "gatilho" TEXT NOT NULL DEFAULT 'COMENTARIO'`,
  `ALTER TABLE "AutoRule" ADD COLUMN "exigirSeguir" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "AutoRule" ADD COLUMN "linkLiberado" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "AutoRule" ADD COLUMN "gateAskText" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "AutoRule" ADD COLUMN "gateButtonLabel" TEXT NOT NULL DEFAULT 'Seguindo'`,
  `ALTER TABLE "AutoRule" ADD COLUMN "gateDeliverText" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "AutoRule" ADD COLUMN "gateLinkLabel" TEXT NOT NULL DEFAULT 'Acessar'`,
];

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS "FollowGate" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "igsid"       TEXT     NOT NULL,
    "ruleId"      TEXT     NOT NULL,
    "status"      TEXT     NOT NULL DEFAULT 'PENDING',
    "attempts"    INTEGER  NOT NULL DEFAULT 0,
    "username"    TEXT     NOT NULL DEFAULT '',
    "origem"      TEXT     NOT NULL DEFAULT 'COMENTARIO',
    "postId"      TEXT,
    "deliveredAt" DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("ruleId") REFERENCES "AutoRule"("id") ON DELETE CASCADE
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "FollowGate_igsid_ruleId_key"
     ON "FollowGate"("igsid","ruleId")`,

  `CREATE INDEX IF NOT EXISTS "FollowGate_igsid_idx"
     ON "FollowGate"("igsid")`,

  `CREATE TABLE IF NOT EXISTS "DmEvent" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "mid"       TEXT     NOT NULL,
    "igsid"     TEXT     NOT NULL,
    "text"      TEXT     NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "DmEvent_mid_key" ON "DmEvent"("mid")`,
];

async function run() {
  for (const sql of COLUNAS) {
    const coluna = sql.match(/ADD COLUMN "(\w+)"/)?.[1] ?? sql;
    try {
      await client.execute(sql);
      console.log("✓ AutoRule." + coluna);
    } catch (e) {
      const msg = (e as Error).message;
      if (/duplicate column/i.test(msg)) console.log("· AutoRule." + coluna + " já existe");
      else throw e;
    }
  }

  for (const sql of TABELAS) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 70));
  }

  console.log("\nMigração da trava de seguidor concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
