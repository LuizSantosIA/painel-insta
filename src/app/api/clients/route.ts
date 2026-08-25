import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { type StatusSaude } from "@/lib/saude";
import { diagnosticarCliente } from "@/lib/saude-server";
import {
  proximaAcaoDoCliente,
  ultimoContato,
  type ProximaAcaoCliente,
} from "@/lib/cliente-360";

/** Uma linha da lista de clientes — já com o que as colunas precisam mostrar. */
export interface ClienteListaItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  company: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  tags: string | null;
  createdAt: string;
  arquivadoEm: string | null;
  saude: StatusSaude;
  /** Por que a saúde é essa — o motivo principal, pronto da engine. */
  saudeResumo: string;
  /** 0–100. Ordena dentro da faixa; a interface mostra a faixa, não o número. */
  saudeScore: number;
  /** Recorrente contratada e em dia na competência do mês. */
  mrrCentavos: number;
  /** Tudo que já entrou de fato, qualquer competência. */
  receitaRecebidaCentavos: number;
  ultimoContatoEm: string | null;
  proximaAcao: ProximaAcaoCliente | null;
  oportunidadesAbertas: number;
  tarefasAbertas: number;
}

export async function GET(req: NextRequest) {
  // Arquivados ficam fora por padrão — o dado continua no banco.
  const incluirArquivados = req.nextUrl.searchParams.get("arquivados") === "1";

  const agora = new Date();

  const clientes = await prisma.client.findMany({
    where: incluirArquivados ? undefined : { arquivadoEm: null },
    orderBy: { createdAt: "desc" },
    include: {
      receitas: true,
      leads: true,
      tasks: true,
      compromissos: true,
      interacoes: { select: { id: true, tipo: true, nota: true, ocorreuEm: true } },
    },
  });

  const ESTAGIOS_ABERTOS = ["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO"];

  const lista: ClienteListaItem[] = clientes.map((c) => {
    // Uma engine só: a mesma que responde a tela de Saúde, o 360° e o painel.
    const diagnostico = diagnosticarCliente(c, agora);

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      instagram: c.instagram,
      company: c.company,
      notes: c.notes,
      status: c.status,
      source: c.source,
      tags: c.tags,
      createdAt: c.createdAt.toISOString(),
      arquivadoEm: c.arquivadoEm?.toISOString() ?? null,
      saude: diagnostico.status,
      saudeResumo: diagnostico.resumo,
      saudeScore: diagnostico.score,
      mrrCentavos: diagnostico.mrrCentavos,
      receitaRecebidaCentavos: c.receitas
        .filter((r) => r.status === "RECEBIDA")
        .reduce((s, r) => s + r.valorCentavos, 0),
      ultimoContatoEm: ultimoContato(c.ultimoContatoEm, c.interacoes),
      proximaAcao: proximaAcaoDoCliente(c.tasks, c.compromissos),
      oportunidadesAbertas: c.leads.filter((l) => ESTAGIOS_ABERTOS.includes(l.estagio)).length,
      tarefasAbertas: c.tasks.filter((t) => !t.done).length,
    };
  });

  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, instagram, company, notes, status, source, tags } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const client = await prisma.client.create({
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      instagram: instagram?.trim() || null,
      company: company?.trim() || null,
      notes: notes?.trim() || null,
      status: status || "lead",
      source: source || null,
      tags: tags?.trim() || null,
    },
  });
  return NextResponse.json(client, { status: 201 });
}
