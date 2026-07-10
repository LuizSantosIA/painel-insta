import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-libsql",
    "@libsql/client",
  ],
  allowedDevOrigins: ["modulator-unselfish-operate.ngrok-free.dev"],
  async redirects() {
    return [
      // Rotas antigas → Máquina
      { source: "/posts",          destination: "/maquina/posts",          permanent: true },
      { source: "/recomendacoes",  destination: "/maquina/recomendacoes",  permanent: true },
      { source: "/horarios",       destination: "/maquina/horarios",       permanent: true },
      { source: "/calendario",     destination: "/maquina/calendario",     permanent: true },
      { source: "/automacoes",     destination: "/maquina/automacoes",     permanent: true },
      { source: "/gerador",        destination: "/maquina/gerador",        permanent: true },
      { source: "/chat",           destination: "/maquina/chat",           permanent: true },
      { source: "/integracao",     destination: "/maquina/integracao",     permanent: true },
      // Rotas antigas → Negócio
      { source: "/clientes",       destination: "/negocio/clientes",       permanent: true },
      { source: "/pipeline",       destination: "/negocio/pipeline",       permanent: true },
      { source: "/tarefas",        destination: "/negocio/tarefas",        permanent: true },
    ];
  },
};

export default nextConfig;
