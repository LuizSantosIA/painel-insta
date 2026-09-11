/**
 * Máquina de conteúdo: tabelas dos agentes, campos novos em Post/AutoRule/Config,
 * migração do único PostRascunho para Post e semeadura dos 4 sistemas visuais.
 *
 * Aditivo, exceto a remoção da tabela PostRascunho — que só acontece DEPOIS de o
 * registro dela virar um Post (e só se a cópia tiver dado certo).
 *
 * Uso: npx tsx prisma/migrate-engine.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const COLUNAS = [
  `ALTER TABLE "Post" ADD COLUMN "etapa" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "tituloInterno" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "tipoConteudo" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "objetivo" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "tema" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "scoreEstrategia" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "scoreFinal" INTEGER`,
  `ALTER TABLE "Post" ADD COLUMN "legendaFinal" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "palavraChave" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "horarioSugerido" DATETIME`,
  `ALTER TABLE "Post" ADD COLUMN "geradoPelaMaquina" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Post" ADD COLUMN "fonteId" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN "estiloVisualId" TEXT`,
  `ALTER TABLE "AutoRule" ADD COLUMN "postId" TEXT`,
  `ALTER TABLE "Config" ADD COLUMN "modoMaquina" TEXT NOT NULL DEFAULT 'COPILOTO'`,
  `ALTER TABLE "Config" ADD COLUMN "tetoExecucoesDia" INTEGER NOT NULL DEFAULT 60`,
];

const TABELAS = [
  `CREATE INDEX IF NOT EXISTS "Post_etapa_idx" ON "Post"("etapa")`,

  `CREATE TABLE IF NOT EXISTS "FonteConteudo" (
    "id"             TEXT     NOT NULL PRIMARY KEY,
    "url"            TEXT     NOT NULL,
    "titulo"         TEXT,
    "autor"          TEXT,
    "plataforma"     TEXT,
    "publicadoEm"    DATETIME,
    "tema"           TEXT,
    "formato"        TEXT,
    "sinais"         TEXT,
    "resumo"         TEXT,
    "porQueFunciona" TEXT,
    "analise"        TEXT,
    "conteudoBruto"  TEXT,
    "origem"         TEXT     NOT NULL DEFAULT 'MANUAL',
    "descartada"     INTEGER  NOT NULL DEFAULT 0,
    "criadoEm"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "FonteConteudo_criadoEm_idx" ON "FonteConteudo"("criadoEm")`,

  `CREATE TABLE IF NOT EXISTS "PostSlide" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "postId"       TEXT     NOT NULL,
    "ordem"        INTEGER  NOT NULL,
    "headline"     TEXT     NOT NULL DEFAULT '',
    "corpo"        TEXT     NOT NULL DEFAULT '',
    "microcopy"    TEXT     NOT NULL DEFAULT '',
    "layout"       TEXT     NOT NULL DEFAULT 'TEXTO',
    "promptVisual" TEXT,
    "imagemUrl"    TEXT,
    "assetUrl"     TEXT,
    "versao"       INTEGER  NOT NULL DEFAULT 1,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PostSlide_postId_ordem_key" ON "PostSlide"("postId","ordem")`,

  `CREATE TABLE IF NOT EXISTS "EstiloVisual" (
    "id"            TEXT     NOT NULL PRIMARY KEY,
    "chave"         TEXT     NOT NULL,
    "nome"          TEXT     NOT NULL,
    "descricao"     TEXT     NOT NULL DEFAULT '',
    "paleta"        TEXT     NOT NULL DEFAULT '{}',
    "tipografia"    TEXT     NOT NULL DEFAULT '',
    "regras"        TEXT     NOT NULL DEFAULT '',
    "referenciaUrl" TEXT,
    "usaAsset"      INTEGER  NOT NULL DEFAULT 0,
    "ativo"         INTEGER  NOT NULL DEFAULT 1,
    "criadoEm"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EstiloVisual_chave_key" ON "EstiloVisual"("chave")`,

  `CREATE TABLE IF NOT EXISTS "ExecucaoAgente" (
    "id"         TEXT     NOT NULL PRIMARY KEY,
    "postId"     TEXT,
    "slideOrdem" INTEGER,
    "agente"     TEXT     NOT NULL,
    "etapa"      TEXT,
    "status"     TEXT     NOT NULL DEFAULT 'OK',
    "entrada"    TEXT     NOT NULL DEFAULT '{}',
    "saida"      TEXT     NOT NULL DEFAULT '{}',
    "prompt"     TEXT     NOT NULL DEFAULT '',
    "modelo"     TEXT     NOT NULL DEFAULT '',
    "tokensIn"   INTEGER  NOT NULL DEFAULT 0,
    "tokensOut"  INTEGER  NOT NULL DEFAULT 0,
    "duracaoMs"  INTEGER  NOT NULL DEFAULT 0,
    "erro"       TEXT,
    "criadoEm"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ExecucaoAgente_postId_criadoEm_idx" ON "ExecucaoAgente"("postId","criadoEm")`,
  `CREATE INDEX IF NOT EXISTS "ExecucaoAgente_agente_criadoEm_idx" ON "ExecucaoAgente"("agente","criadoEm")`,
  `CREATE INDEX IF NOT EXISTS "ExecucaoAgente_criadoEm_idx" ON "ExecucaoAgente"("criadoEm")`,

  `CREATE TABLE IF NOT EXISTS "RevisaoConteudo" (
    "id"       TEXT     NOT NULL PRIMARY KEY,
    "postId"   TEXT     NOT NULL,
    "decisao"  TEXT     NOT NULL,
    "escopo"   TEXT     NOT NULL DEFAULT 'POST',
    "motivo"   TEXT     NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "RevisaoConteudo_postId_criadoEm_idx" ON "RevisaoConteudo"("postId","criadoEm")`,

  `CREATE TABLE IF NOT EXISTS "PostMetricaSnapshot" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "postId"      TEXT     NOT NULL,
    "janela"      TEXT     NOT NULL,
    "likes"       INTEGER  NOT NULL DEFAULT 0,
    "comments"    INTEGER  NOT NULL DEFAULT 0,
    "saves"       INTEGER  NOT NULL DEFAULT 0,
    "shares"      INTEGER  NOT NULL DEFAULT 0,
    "reach"       INTEGER  NOT NULL DEFAULT 0,
    "impressions" INTEGER  NOT NULL DEFAULT 0,
    "leads"       INTEGER  NOT NULL DEFAULT 0,
    "coletadoEm"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PostMetricaSnapshot_postId_janela_key" ON "PostMetricaSnapshot"("postId","janela")`,

  `CREATE TABLE IF NOT EXISTS "Aprendizado" (
    "id"       TEXT     NOT NULL PRIMARY KEY,
    "origem"   TEXT     NOT NULL,
    "texto"    TEXT     NOT NULL,
    "tags"     TEXT     NOT NULL DEFAULT '',
    "peso"     INTEGER  NOT NULL DEFAULT 1,
    "ativo"    INTEGER  NOT NULL DEFAULT 1,
    "postId"   TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "Aprendizado_ativo_criadoEm_idx" ON "Aprendizado"("ativo","criadoEm")`,
];

/** Os 4 sistemas visuais que você descreveu. Regras são lidas pelo Diretor Visual. */
const ESTILOS = [
  {
    chave: "EDITORIAL_ORANGE",
    nome: "Editorial Orange",
    descricao: "Off-white, preto e laranja. Textura editorial, tipografia condensada grande, detalhes técnicos, grid. Visual de manual/pôster.",
    paleta: { fundo: "#F4F1EA", texto: "#111111", destaque: "#FF5A1F", secundaria: "#6B6B6B" },
    tipografia: "Condensada pesada para headline, grotesca para corpo",
    regras: "Headline domina o slide. Um único acento laranja por slide. Numeração e marcadores técnicos pequenos nos cantos. Muito contraste.",
    usaAsset: false,
  },
  {
    chave: "BLUE_TECH",
    nome: "Blue Tech",
    descricao: "Branco, grid técnico, azul elétrico, cards, elementos de interface e terminal. Visual tech moderno.",
    paleta: { fundo: "#FFFFFF", texto: "#0B1220", destaque: "#1268FF", secundaria: "#5B6B85" },
    tipografia: "Grotesca moderna; monoespaçada para trechos de código e rótulos",
    regras: "Conteúdo em cards sobre grid fino. Azul só em destaque e bordas. Trechos técnicos em mono. Nada de gradiente.",
    usaAsset: false,
  },
  {
    chave: "MINIMAL_EDITORIAL",
    nome: "Minimal Editorial",
    descricao: "Muito espaço em branco, tipografia editorial, preto, laranja sutil, grids discretos.",
    paleta: { fundo: "#FFFFFF", texto: "#141414", destaque: "#E8501A", secundaria: "#8A8A8A" },
    tipografia: "Serifada editorial para headline, grotesca leve para corpo",
    regras: "Pouco texto por slide. Margens generosas. Laranja só em um detalhe pequeno. Respiro é parte do design.",
    usaAsset: false,
  },
  {
    chave: "VOXEL_TECH",
    nome: "Voxel Tech",
    descricao: "Personagem 3D voxel, interfaces técnicas, estética retro-tech, diagramas, elementos físicos.",
    paleta: { fundo: "#0E1116", texto: "#F2F4F8", destaque: "#4F8CFF", secundaria: "#8B96A8" },
    tipografia: "Grotesca; mono para rótulos de diagrama",
    regras: "Cada slide tem um elemento 3D voxel como protagonista visual. Diagramas e setas explicam. O texto acompanha, não domina.",
    usaAsset: true,
  },
];

async function run() {
  for (const sql of COLUNAS) {
    const m = sql.match(/ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/);
    const nome = m ? `${m[1]}.${m[2]}` : sql;
    try {
      await client.execute(sql);
      console.log("✓", nome);
    } catch (e) {
      const msg = (e as Error).message;
      if (/duplicate column/i.test(msg)) console.log("·", nome, "já existe");
      else throw e;
    }
  }

  for (const sql of TABELAS) {
    await client.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 70));
  }

  // ── Sistemas visuais: cria só os que ainda não existem ──
  for (const e of ESTILOS) {
    const existe = await client.execute({ sql: `SELECT 1 FROM "EstiloVisual" WHERE chave = ?`, args: [e.chave] });
    if (existe.rows.length) { console.log("·", e.chave, "já existe"); continue; }
    await client.execute({
      sql: `INSERT INTO "EstiloVisual" (id, chave, nome, descricao, paleta, tipografia, regras, usaAsset)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `estilo_${e.chave.toLowerCase()}`,
        e.chave, e.nome, e.descricao, JSON.stringify(e.paleta), e.tipografia, e.regras, e.usaAsset ? 1 : 0,
      ],
    });
    console.log("✓ estilo", e.chave);
  }

  // ── PostRascunho → Post ──
  const temTabela = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='PostRascunho'`
  );
  if (temTabela.rows.length) {
    const rascunhos = await client.execute(`SELECT * FROM "PostRascunho"`);
    let migrados = 0;
    for (const r of rascunhos.rows) {
      const id = `post_migrado_${r.id}`;
      const ja = await client.execute({ sql: `SELECT 1 FROM "Post" WHERE id = ?`, args: [id] });
      if (ja.rows.length) continue;
      await client.execute({
        sql: `INSERT INTO "Post" (id, caption, mediaType, postedAt, status, etapa, tituloInterno, source, geradoPelaMaquina, createdAt, updatedAt)
              VALUES (?, ?, 'CAROUSEL_ALBUM', ?, 'RASCUNHO', 'COPY', ?, 'manual', 1, ?, ?)`,
        args: [id, String(r.legenda ?? ""), String(r.geradoEm), String(r.topico ?? "Rascunho migrado"), String(r.geradoEm), String(r.atualizadoEm)],
      });
      // Slides do JSON antigo [{titulo, corpo}] viram PostSlide
      try {
        const slides = JSON.parse(String(r.slides ?? "[]")) as { titulo?: string; corpo?: string }[];
        for (let i = 0; i < slides.length; i++) {
          await client.execute({
            sql: `INSERT INTO "PostSlide" (id, postId, ordem, headline, corpo) VALUES (?, ?, ?, ?, ?)`,
            args: [`${id}_s${i + 1}`, id, i + 1, slides[i].titulo ?? "", slides[i].corpo ?? ""],
          });
        }
      } catch { /* slides ilegíveis: o post fica sem slides, mas não se perde */ }
      migrados++;
    }
    console.log(`✓ PostRascunho → Post: ${migrados} migrado(s) de ${rascunhos.rows.length}`);

    const restantes = await client.execute(`SELECT COUNT(*) AS n FROM "PostRascunho"`);
    const copiados = await client.execute(`SELECT COUNT(*) AS n FROM "Post" WHERE id LIKE 'post_migrado_%'`);
    if (Number(copiados.rows[0].n) >= Number(restantes.rows[0].n)) {
      await client.execute(`DROP TABLE "PostRascunho"`);
      console.log("✓ PostRascunho removida (todos os registros estão em Post)");
    } else {
      console.log("! PostRascunho mantida: cópia incompleta, conferir manualmente");
    }
  }

  console.log("\nMigração da máquina de conteúdo concluída.");
  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
