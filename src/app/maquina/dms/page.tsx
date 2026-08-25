import { redirect } from "next/navigation";

/** Rota antiga preservada: DMs virou Conversas, com estado no funil e origem. */
export default function DmsPage() {
  redirect("/maquina/conversas");
}
