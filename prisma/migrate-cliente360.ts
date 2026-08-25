/**
 * CRM 360°: liga Lead e Compromisso ao Cliente, permite arquivar, guarda quando
 * uma tarefa foi concluída e cria a tabela de interações.
 *
 * Tudo aditivo — nenhuma coluna é removida ou renomeada, e os registros
 * existentes continuam válidos (os campos novos nascem NULL).
 *
 * Uso: npx tsx prisma/migrate-cliente360.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

// SQLite não tem ADD COLUMN IF NOT EXISTS — rodamos uma a uma e ignoramos duplicadas.
const COLUNAS = [
  `ALTER TABLE "Client" ADD COLUMN "arquivadoEm" DATETIME`,
  `ALTER TABLE "Task" ADD COLUMN "concluidaEm" DATETIME`,
  `ALTER TABLE "Lead" ADD COLUMN "clienteId" TEXT REFERENCES "Client"("id") ON DELETE SET NULL`,
  `ALTER TABLE "Compromisso" ADD COLUMN "clienteId" TEXT REFERENCES "Client"("id") ON DELETE SET NULL`,
];

const RESTO = [
  `CREATE INDEX IF NOT EXISTS "Client_arquivadoEm_idx" ON "Client"("arquivadoEm")`,
  `CREATE INDEX IF NOT EXISTS "Lead_clienteId_idx" ON "Lead"("clienteId")`,
  `CREATE INDEX IF NOT EXISTS "Compromisso_clienteId_idx" ON "Compromisso"("clienteId")`,

  `CREATE TABLE IF NOT EXISTS "Interacao" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "clienteId" TEXT     NOT NULL,
    "tipo"      TEXT     NOT NULL,
    "nota"      TEXT     NOT NULL DEFAULT '',
    "ocorreuEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("clienteId") REFERENCES "Client"("id") ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "Interacao_clienteId_ocorreuEm_idx"
     ON "Interacao"("clienteId","ocorreuEm")`,
];

async function run() {
  for (const sql of COLUNAS) {
    const alvo = sql.match(/ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/);
    const nome = alvo ? `${alvo[1]}.${alvo[2]}` : sql;
    try {
      await client.execute(sql);
      console.log("✓", nome);
    } catch (e) {
      const msg = (e as Error).message;
      if (/duplicate column/i.test(msg)) console.log("·", nome, "já existe");
      else throw e;
    }
  }

  for (const sql of RESTO) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 66));
  }

  console.log("\nMigração do CRM 360° concluída.");
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
