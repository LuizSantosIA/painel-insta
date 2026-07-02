import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mantém os pacotes nativos do Prisma/libSQL fora do bundle do servidor.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-libsql",
    "@libsql/client",
  ],
  allowedDevOrigins: ["modulator-unselfish-operate.ngrok-free.dev"],
};

export default nextConfig;
