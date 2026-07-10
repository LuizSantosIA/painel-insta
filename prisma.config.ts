import "dotenv/config";
import { defineConfig } from "prisma/config";

const strip = (v?: string) => (v ?? "").replace(/^﻿/, "");

// Nota: prisma db push não funciona com libsql://. Use prisma/migrate-financeiro.ts
// para novos modelos. O defineConfig precisa de datasource.url para o generate.
const base  = strip(process.env.DATABASE_URL);
const token = strip(process.env.TURSO_AUTH_TOKEN);

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: token ? `${base}?authToken=${token}` : base },
});
