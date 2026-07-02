import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

const databaseUrl = strip(process.env.DATABASE_URL) || "file:./dev.db";

const adapter = new PrismaLibSql({
  url: databaseUrl,
  authToken: strip(process.env.TURSO_AUTH_TOKEN) || undefined,
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}