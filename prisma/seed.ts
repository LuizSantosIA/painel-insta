import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Multiplicadores "plantados" para criar padrões que o painel vai revelar:
// Reels e Carrossel engajam mais; certos temas também.
const TYPE_WEIGHT: Record<string, number> = {
  REELS: 1.0,
  CAROUSEL_ALBUM: 0.85,
  IMAGE: 0.55,
  VIDEO: 0.6,
};
const TYPE_DISTRIBUTION = ["REELS", "REELS", "CAROUSEL_ALBUM", "CAROUSEL_ALBUM", "IMAGE", "VIDEO"];

const CATEGORY_WEIGHT: Record<string, number> = {
  Dica: 1.1,
  Educativo: 1.05,
  Bastidores: 0.95,
  Trend: 1.0,
  Inspiração: 0.9,
  Depoimento: 0.85,
  Promoção: 0.7,
  Novidade: 0.8,
};

const CAPTIONS = [
  "3 erros que você comete sem perceber 👀",
  "Salva esse post pra não esquecer!",
  "O bastidor que ninguém te mostra",
  "Você sabia disso? Comenta aí 👇",
  "Antes x Depois — o resultado surpreende",
  "Passo a passo completo no carrossel ➡️",
  "A trend do momento (testa e me conta)",
  "Promo relâmpago só hoje 🔥",
  "Novidade chegando! Já viu?",
  "O depoimento que me emocionou ❤️",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function main() {
  await prisma.post.deleteMany();
  await prisma.accountSnapshot.deleteMany();

  const now = new Date();
  const DAYS = 90;
  const POSTS = 64;
  const startFollowers = 4200;
  const endFollowers = 7350;

  // Snapshots diários de seguidores (crescimento + leve ruído).
  for (let d = DAYS; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    date.setHours(0, 0, 0, 0);
    const t = (DAYS - d) / DAYS;
    const followers = Math.round(
      startFollowers + (endFollowers - startFollowers) * t + rand(-40, 40)
    );
    await prisma.accountSnapshot.create({
      data: {
        date,
        followers,
        follows: Math.round(rand(500, 620)),
        reach: Math.round(rand(800, 3200)),
      },
    });
  }

  function followersAt(date: Date): number {
    const daysAgo = (now.getTime() - date.getTime()) / 86_400_000;
    const t = Math.max(0, Math.min(1, (DAYS - daysAgo) / DAYS));
    return Math.round(startFollowers + (endFollowers - startFollowers) * t);
  }

  for (let i = 0; i < POSTS; i++) {
    const daysAgo = Math.floor(rand(0, DAYS));
    const postedAt = new Date(now);
    postedAt.setDate(now.getDate() - daysAgo);
    // Horário enviesado para fim de tarde/noite (bom engajamento).
    const hourBucket = pick([8, 9, 12, 13, 18, 19, 20, 20, 21, 21]);
    postedAt.setHours(hourBucket, Math.floor(rand(0, 59)), 0, 0);

    const mediaType = pick(TYPE_DISTRIBUTION);
    const category = pick(DEFAULT_CATEGORIES);
    const followers = followersAt(postedAt);

    const typeMult = TYPE_WEIGHT[mediaType] ?? 0.6;
    const catMult = CATEGORY_WEIGHT[category] ?? 1;
    // Bônus de horário nobre.
    const hourMult = hourBucket >= 18 && hourBucket <= 21 ? 1.15 : 0.95;
    const quality = rand(0.6, 1.4); // variação por post

    const reach = Math.round(followers * rand(0.35, 0.95) * typeMult * hourMult);
    const baseRate = 0.05 * typeMult * catMult * hourMult * quality; // taxa de engajamento
    const totalEng = Math.round(reach * baseRate);

    const saves = Math.round(totalEng * rand(0.08, 0.22) * (catMult > 1 ? 1.3 : 1));
    const shares = Math.round(totalEng * rand(0.04, 0.12));
    const comments = Math.round(totalEng * rand(0.05, 0.12));
    const likes = Math.max(0, totalEng - saves - shares - comments);
    const videoViews =
      mediaType === "REELS" || mediaType === "VIDEO"
        ? Math.round(reach * rand(1.2, 2.4))
        : 0;

    await prisma.post.create({
      data: {
        caption: pick(CAPTIONS),
        mediaType,
        category,
        permalink: "https://instagram.com",
        thumbnailUrl: null,
        postedAt,
        likes,
        comments,
        saves,
        shares,
        reach,
        impressions: Math.round(reach * rand(1.05, 1.3)),
        videoViews,
        followersAtPost: followers,
        source: "manual",
      },
    });
  }

  const count = await prisma.post.count();
  console.log(`✅ Seed concluído: ${count} posts + ${DAYS + 1} snapshots criados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });