import { NextResponse } from "next/server";
import { carregarMaquina, type ConversaMaquina } from "@/lib/maquina-dados";
import { LABEL_STATUS_CONVERSA, type StatusConversa } from "@/lib/maquina";

export interface ConversasLista {
  conversas: ConversaMaquina[];
  /** Quantidade por estado, na ordem em que a tela mostra os filtros. */
  porStatus: { status: StatusConversa; label: string; total: number }[];
  ultimaSincronizacao: string | null;
}

const ORDEM: StatusConversa[] = [
  "NOVA",
  "AGUARDANDO_VOCE",
  "AGUARDANDO_CONTATO",
  "LEAD",
  "OPORTUNIDADE",
];

export async function GET() {
  const dados = await carregarMaquina();

  const resposta: ConversasLista = {
    conversas: dados.conversas,
    porStatus: ORDEM.map((status) => ({
      status,
      label: LABEL_STATUS_CONVERSA[status],
      total: dados.conversas.filter((c) => c.status === status).length,
    })),
    ultimaSincronizacao: dados.meta.ultimaSincronizacaoConversas,
  };

  return NextResponse.json(resposta);
}
