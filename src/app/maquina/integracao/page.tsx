import { redirect } from "next/navigation";

/** Rota antiga preservada: Integração virou a área de configuração Integrações. */
export default function IntegracaoPage() {
  redirect("/maquina/integracoes");
}
