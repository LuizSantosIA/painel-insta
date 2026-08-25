/**
 * Financeiro operacional: data de vencimento nas receitas, vínculo com a
 * oportunidade que as originou, agrupamento das competências de uma mesma
 * recorrência e categoria nas despesas.
 *
 * Tudo aditivo — nenhuma coluna é removida ou renomeada, nenhum dado é reescrito.
 * As colunas novas nascem NULL (ou com o default) e os registros existentes
 * continuam válidos: sem `vencimento`, a regra de atraso usa o último dia da
 * competência, exatamente o comportamento que valia antes desta migração.
 *
 * Uso: npx tsx prisma/migrate-financeiro-operacional.ts
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
  `ALTER TABLE "Receita" ADD COLUMN "vencimento" DATETIME`,
  `ALTER TABLE "Receita" ADD COLUMN "leadId" TEXT REFERENCES "Lead"("id") ON DELETE SET NULL`,
  `ALTER TABLE "Receita" ADD COLUMN "contratoId" TEXT`,
  `ALTER TABLE "Despesa" ADD COLUMN "categoria" TEXT NOT NULL DEFAULT 'OUTROS'`,
];

const INDICES = [
  `CREATE INDEX IF NOT EXISTS "Receita_vencimento_idx" ON "Receita"("vencimento")`,
  `CREATE INDEX IF NOT EXISTS "Receita_leadId_idx" ON "Receita"("leadId")`,
  `CREATE INDEX IF NOT EXISTS "Receita_contratoId_idx" ON "Receita"("contratoId")`,
];

/**
 * Toda recorrente já existente vira a primeira competência do próprio contrato.
 * Sem isto, "replicar recorrentes" não teria como saber o que já foi lançado —
 * e duplicaria a mensalidade do mês seguinte.
 */
const BACKFILL = [
  `UPDATE "Receita" SET "contratoId" = "id"
     WHERE "tipo" = 'RECORRENTE' AND "contratoId" IS NULL`,
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

  for (const sql of INDICES) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 66));
  }

  for (const sql of BACKFILL) {
    const r = await client.execute(sql);
    console.log("✓ backfill contratoId —", r.rowsAffected, "recorrente(s)");
  }

  console.log("\nMigração do financeiro operacional concluída.");
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
