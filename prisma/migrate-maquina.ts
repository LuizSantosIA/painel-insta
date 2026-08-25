/**
 * Máquina — sistema de aquisição.
 *
 * Liga o que já existia em ilhas: o conteúdo ganha um pipeline editorial e o lead
 * passa a lembrar de qual conversa e de qual automação ele veio. Com isso a cadeia
 * CONTEÚDO → CONVERSA → LEAD → OPORTUNIDADE → CLIENTE → RECEITA vira consultável.
 *
 * Tudo aditivo:
 *   · Post.status nasce 'PUBLICADO' — todo post que já está no banco veio do
 *     Instagram, ou seja, já foi publicado. Nenhuma tela muda de comportamento.
 *   · Post.agendadoPara, Lead.conversaId e Lead.automacaoId nascem NULL. Não dá
 *     para descobrir retroativamente qual conversa gerou um lead antigo, e chutar
 *     isso faria a atribuição mentir.
 *   · Os índices são de performance: a atribuição agrupa CommentLog por post e
 *     cruza o comentarista com a conversa do direct.
 *
 * Nada é removido ou renomeado.
 *
 * Uso: npx tsx prisma/migrate-maquina.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

// SQLite não tem ADD COLUMN IF NOT EXISTS — roda uma a uma e ignora duplicadas.
const COLUNAS = [
  `ALTER TABLE "Post" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PUBLICADO'`,
  `ALTER TABLE "Post" ADD COLUMN "agendadoPara" DATETIME`,
  `ALTER TABLE "Lead" ADD COLUMN "conversaId" TEXT REFERENCES "IgConversation"("id") ON DELETE SET NULL`,
  `ALTER TABLE "Lead" ADD COLUMN "automacaoId" TEXT REFERENCES "AutoRule"("id") ON DELETE SET NULL`,
];

const INDICES = [
  `CREATE INDEX IF NOT EXISTS "Post_status_idx" ON "Post"("status")`,
  `CREATE INDEX IF NOT EXISTS "Lead_conversaId_idx" ON "Lead"("conversaId")`,
  `CREATE INDEX IF NOT EXISTS "Lead_postOrigemId_idx" ON "Lead"("postOrigemId")`,
  `CREATE INDEX IF NOT EXISTS "CommentLog_igPostId_idx" ON "CommentLog"("igPostId")`,
  `CREATE INDEX IF NOT EXISTS "CommentLog_senderId_idx" ON "CommentLog"("senderId")`,
  `CREATE INDEX IF NOT EXISTS "IgConversation_igUserId_idx" ON "IgConversation"("igUserId")`,
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
    console.log("✓", sql.match(/"(\w+_idx)"/)?.[1] ?? sql);
  }

  // Confere o que a atribuição consegue enxergar com os dados de hoje.
  const [posts, comentarios, conversas, ligadas, leads] = await Promise.all([
    client.execute(`SELECT COUNT(*) n FROM "Post" WHERE "status" = 'PUBLICADO'`),
    client.execute(`SELECT COUNT(*) n FROM "CommentLog" WHERE "igPostId" <> ''`),
    client.execute(`SELECT COUNT(*) n FROM "IgConversation"`),
    client.execute(
      `SELECT COUNT(DISTINCT ic."id") n
         FROM "IgConversation" ic
         JOIN "CommentLog" cl ON cl."senderId" = ic."igUserId"`
    ),
    client.execute(`SELECT COUNT(*) n FROM "Lead"`),
  ]);

  console.log("\nCadeia visível hoje:");
  console.log(`  ${posts.rows[0].n} conteúdos publicados`);
  console.log(`  ${comentarios.rows[0].n} comentários com post de origem conhecido`);
  console.log(
    `  ${ligadas.rows[0].n} de ${conversas.rows[0].n} conversas rastreáveis até um post`
  );
  console.log(`  ${leads.rows[0].n} leads no pipeline`);
  console.log(
    "\nLeads antigos ficam sem conversaId/automacaoId de propósito — a partir de agora" +
      "\ntoda conversa transformada em lead grava a origem."
  );

  console.log("\nMigração da Máquina concluída.");
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
