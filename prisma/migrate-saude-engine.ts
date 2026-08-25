/**
 * Engine de saúde: guarda a última classificação calculada de cada cliente, para
 * que uma mudança de faixa possa virar evento na timeline do Cliente 360°.
 *
 * Aditivo — as colunas nascem NULL e nenhum registro existente muda de
 * significado. O histórico começa na primeira avaliação depois desta migração:
 * nada é reconstruído para trás.
 *
 * Uso: npm run db:migrate-saude-engine
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^\uFEFF/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

// SQLite não tem ADD COLUMN IF NOT EXISTS — rodamos uma a uma e ignoramos duplicadas.
const COLUNAS = [
  `ALTER TABLE "Client" ADD COLUMN "saudeStatus" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN "saudeAvaliadaEm" DATETIME`,
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

  console.log("\nMigração da engine de saúde concluída.");
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
