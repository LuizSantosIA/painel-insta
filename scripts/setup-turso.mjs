import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igId" TEXT,
    "caption" TEXT,
    "mediaType" TEXT NOT NULL,
    "category" TEXT,
    "permalink" TEXT,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "postedAt" DATETIME NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "videoViews" INTEGER NOT NULL DEFAULT 0,
    "followersAtPost" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Post_igId_key" ON "Post"("igId")`,
  `CREATE INDEX IF NOT EXISTS "Post_postedAt_idx" ON "Post"("postedAt")`,
  `CREATE INDEX IF NOT EXISTS "Post_mediaType_idx" ON "Post"("mediaType")`,
  `CREATE INDEX IF NOT EXISTS "Post_category_idx" ON "Post"("category")`,

  `CREATE TABLE IF NOT EXISTS "AccountSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "followers" INTEGER NOT NULL,
    "follows" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AccountSnapshot_date_key" ON "AccountSnapshot"("date")`,

  `CREATE TABLE IF NOT EXISTS "AutoRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL,
    "replyText" TEXT NOT NULL DEFAULT '',
    "sendDm" INTEGER NOT NULL DEFAULT 0,
    "dmText" TEXT NOT NULL DEFAULT '',
    "mediaId" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "AutoRule_mediaId_idx" ON "AutoRule"("mediaId")`,

  `CREATE TABLE IF NOT EXISTS "CommentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igCommentId" TEXT NOT NULL,
    "igPostId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "senderId" TEXT NOT NULL DEFAULT '',
    "repliedAt" DATETIME,
    "dmSentAt" DATETIME,
    "ruleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutoRule"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CommentLog_igCommentId_key" ON "CommentLog"("igCommentId")`,
];

for (const sql of statements) {
  await client.execute(sql);
  console.log("✓", sql.slice(0, 60).replace(/\n/g, " ").trim() + "...");
}

console.log("\nTurso pronto! Todas as tabelas criadas.");
