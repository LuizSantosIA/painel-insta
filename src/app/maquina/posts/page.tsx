import { redirect } from "next/navigation";

/** Rota antiga preservada: Posts virou a central de Conteúdo. */
export default function PostsPage() {
  redirect("/maquina/conteudo");
}
