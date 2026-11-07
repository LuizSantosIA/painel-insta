/**
 * Radar de prospecção — Fase 1: tabelas, alvos iniciais e configuração.
 *
 * Totalmente aditivo: cria 6 tabelas novas e não toca em nenhuma existente.
 * A ligação com Lead é só uma coluna em RadarProspect (leadId), então o
 * pipeline atual continua exatamente como está.
 *
 * Semeia os alvos de Brasília (revendas, clínicas nichadas, imobiliárias) e a
 * configuração padrão. Rodar duas vezes não duplica nada.
 *
 * Uso: npx tsx prisma/migrate-radar.ts
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const client = createClient({
  url: strip(process.env.DATABASE_URL) || "file:./dev.db",
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS "RadarExecucao" (
    "id"                 TEXT     NOT NULL PRIMARY KEY,
    "iniciadoEm"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadoEm"        DATETIME,
    "status"             TEXT     NOT NULL DEFAULT 'RODANDO',
    "origem"             TEXT     NOT NULL DEFAULT 'CRON',
    "apifyRunId"         TEXT,
    "apifyDatasetId"     TEXT,
    "encontrados"        INTEGER  NOT NULL DEFAULT 0,
    "novos"              INTEGER  NOT NULL DEFAULT 0,
    "descartados"        INTEGER  NOT NULL DEFAULT 0,
    "descartesJson"      TEXT,
    "pontuados"          INTEGER  NOT NULL DEFAULT 0,
    "comMensagem"        INTEGER  NOT NULL DEFAULT 0,
    "custoApifyCentavos" INTEGER  NOT NULL DEFAULT 0,
    "custoIaCentavos"    INTEGER  NOT NULL DEFAULT 0,
    "erro"               TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS "RadarExecucao_iniciadoEm_idx" ON "RadarExecucao"("iniciadoEm")`,
  `CREATE INDEX IF NOT EXISTS "RadarExecucao_status_idx" ON "RadarExecucao"("status")`,

  `CREATE TABLE IF NOT EXISTS "RadarProspect" (
    "id"                  TEXT     NOT NULL PRIMARY KEY,
    "placeId"             TEXT     NOT NULL,
    "nome"                TEXT     NOT NULL,
    "endereco"            TEXT,
    "bairro"              TEXT,
    "cidade"              TEXT     NOT NULL,
    "uf"                  TEXT     NOT NULL DEFAULT 'DF',
    "telefone"            TEXT,
    "telefoneE164"        TEXT,
    "tipoTelefone"        TEXT     NOT NULL DEFAULT 'SEM',
    "site"                TEXT,
    "instagram"           TEXT,
    "facebook"            TEXT,
    "whatsapp"            TEXT,
    "notaMaps"            REAL,
    "totalAvaliacoes"     INTEGER  NOT NULL DEFAULT 0,
    "categorias"          TEXT     NOT NULL DEFAULT '',
    "horario"             TEXT,
    "avaliacoesJson"      TEXT,
    "vertical"            TEXT     NOT NULL,
    "cidadeBusca"         TEXT     NOT NULL,
    "anuncioStatus"       TEXT     NOT NULL DEFAULT 'NAO_VERIFICADO',
    "anuncioQtd"          INTEGER  NOT NULL DEFAULT 0,
    "anuncioMaisAntigoEm" DATETIME,
    "doresJson"           TEXT,
    "sinaisOperacaoJson"  TEXT,
    "resumoIa"            TEXT,
    "score"               INTEGER  NOT NULL DEFAULT 0,
    "scoreBreakdown"      TEXT,
    "msg1"                TEXT,
    "msg2"                TEXT,
    "msgFollowup"         TEXT,
    "mensagensGeradasEm"  DATETIME,
    "status"              TEXT     NOT NULL DEFAULT 'NOVO',
    "enviadoEm"           DATETIME,
    "respondidoEm"        DATETIME,
    "followupVenceEm"     DATETIME,
    "leadId"              TEXT,
    "execucaoId"          TEXT,
    "criadoEm"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("leadId")     REFERENCES "Lead"("id")          ON DELETE SET NULL,
    FOREIGN KEY ("execucaoId") REFERENCES "RadarExecucao"("id") ON DELETE SET NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RadarProspect_placeId_key" ON "RadarProspect"("placeId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RadarProspect_telefoneE164_key" ON "RadarProspect"("telefoneE164")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RadarProspect_leadId_key" ON "RadarProspect"("leadId")`,
  `CREATE INDEX IF NOT EXISTS "RadarProspect_status_score_idx" ON "RadarProspect"("status","score")`,
  `CREATE INDEX IF NOT EXISTS "RadarProspect_vertical_cidade_idx" ON "RadarProspect"("vertical","cidade")`,
  `CREATE INDEX IF NOT EXISTS "RadarProspect_execucaoId_idx" ON "RadarProspect"("execucaoId")`,

  `CREATE TABLE IF NOT EXISTS "RadarContato" (
    "id"         TEXT     NOT NULL PRIMARY KEY,
    "prospectId" TEXT     NOT NULL,
    "tipo"       TEXT     NOT NULL,
    "nota"       TEXT     NOT NULL DEFAULT '',
    "ocorreuEm"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("prospectId") REFERENCES "RadarProspect"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "RadarContato_prospectId_ocorreuEm_idx" ON "RadarContato"("prospectId","ocorreuEm")`,

  `CREATE TABLE IF NOT EXISTS "RadarBloqueio" (
    "id"       TEXT     NOT NULL PRIMARY KEY,
    "chave"    TEXT     NOT NULL,
    "tipo"     TEXT     NOT NULL,
    "nome"     TEXT     NOT NULL DEFAULT '',
    "motivo"   TEXT     NOT NULL DEFAULT '',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RadarBloqueio_chave_key" ON "RadarBloqueio"("chave")`,

  `CREATE TABLE IF NOT EXISTS "RadarAlvo" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "vertical"     TEXT     NOT NULL,
    "verticalNome" TEXT     NOT NULL,
    "termosBusca"  TEXT     NOT NULL,
    "cidade"       TEXT     NOT NULL,
    "uf"           TEXT     NOT NULL DEFAULT 'DF',
    "ativo"        INTEGER  NOT NULL DEFAULT 1,
    "criadoEm"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RadarAlvo_vertical_cidade_key" ON "RadarAlvo"("vertical","cidade")`,
  `CREATE INDEX IF NOT EXISTS "RadarAlvo_ativo_idx" ON "RadarAlvo"("ativo")`,

  `CREATE TABLE IF NOT EXISTS "RadarConfig" (
    "id"                 TEXT     NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "minAvaliacoes"      INTEGER  NOT NULL DEFAULT 30,
    "redesExcluidas"     TEXT     NOT NULL DEFAULT '[]',
    "pesosJson"          TEXT     NOT NULL DEFAULT '{}',
    "leadsPorDia"        INTEGER  NOT NULL DEFAULT 20,
    "metaDiariaEnvios"   INTEGER  NOT NULL DEFAULT 20,
    "tetoCustoCentavos"  INTEGER  NOT NULL DEFAULT 1000,
    "actorMaps"          TEXT     NOT NULL DEFAULT 'compass/crawler-google-places',
    "actorAds"           TEXT     NOT NULL DEFAULT '',
    "maxResultadosBusca" INTEGER  NOT NULL DEFAULT 100,
    "atualizadoEm"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

/** Brasília primeiro, como combinado. Goiânia entra desligada, pronta para ligar. */
const ALVOS = [
  {
    vertical: "REVENDA",
    verticalNome: "Revendas de automóveis",
    termos: ["revenda de carros", "loja de veículos", "concessionária de seminovos", "comprar carro usado"],
    cidades: [["Brasília", "DF", 1], ["Goiânia", "GO", 0]] as const,
  },
  {
    vertical: "CLINICA",
    verticalNome: "Clínicas nichadas",
    // Nichadas de propósito: policlínica grande não é o perfil.
    termos: ["clínica odontológica", "clínica de estética", "dermatologista", "ginecologista", "harmonização facial"],
    cidades: [["Brasília", "DF", 1], ["Goiânia", "GO", 0]] as const,
  },
  {
    vertical: "IMOBILIARIA",
    verticalNome: "Imobiliárias",
    termos: ["imobiliária", "corretor de imóveis", "venda de apartamentos"],
    cidades: [["Brasília", "DF", 1], ["Goiânia", "GO", 0]] as const,
  },
];

const PESOS_PADRAO = {
  anuncioAtivo: 30,
  anuncioProvavel: 15,
  volumeAvaliacoes: 20,
  sinaisOperacao: 20,
  doresQueResolvo: 20,
  whatsappProvavel: 10,
};

async function run() {
  console.log("Radar de prospecção — Fase 1\n");

  for (const sql of TABELAS) {
    const nome = sql.match(/(?:TABLE|INDEX) IF NOT EXISTS "(\w+)"/)?.[1] ?? "?";
    await client.execute(sql);
    console.log(`✓ ${sql.startsWith("CREATE TABLE") ? "tabela" : "índice"} ${nome}`);
  }

  // Configuração: cria se não existir, nunca sobrescreve o que você já ajustou.
  await client.execute({
    sql: `INSERT OR IGNORE INTO "RadarConfig" (id, pesosJson, atualizadoEm) VALUES ('singleton', ?, CURRENT_TIMESTAMP)`,
    args: [JSON.stringify(PESOS_PADRAO)],
  });
  console.log("\n✓ RadarConfig (pesos padrão, teto R$ 10,00 por execução)");

  let criados = 0;
  for (const a of ALVOS) {
    for (const [cidade, uf, ativo] of a.cidades) {
      const r = await client.execute({
        sql: `INSERT OR IGNORE INTO "RadarAlvo" (id, vertical, verticalNome, termosBusca, cidade, uf, ativo)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `alvo_${a.vertical.toLowerCase()}_${cidade.toLowerCase().replace(/[^a-z]/g, "")}`,
          a.vertical,
          a.verticalNome,
          JSON.stringify(a.termos),
          cidade,
          uf,
          ativo,
        ],
      });
      if (r.rowsAffected > 0) criados++;
    }
  }
  console.log(`✓ RadarAlvo: ${criados} alvo(s) semeado(s) — Brasília ativa, Goiânia desligada`);

  const n = await client.execute(`SELECT COUNT(*) AS n FROM "RadarProspect"`);
  console.log(`\nProspects na base: ${n.rows[0].n}`);
  console.log("Migração concluída.");
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
