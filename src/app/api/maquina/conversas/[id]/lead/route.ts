import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validarLeadAtivo } from "@/lib/pipeline";

/**
 * Transforma uma conversa do direct em lead no pipeline.
 *
 * A regra que importa é: NÃO DUPLICAR. Se já existe um lead com o mesmo contato
 * (@handle), ele é reaproveitado e apenas passa a lembrar da conversa. O mesmo
 * vale para o cliente: se já existe um Client com aquele @, o lead nasce ligado a
 * ele — nunca criamos um cliente novo por conta própria, porque quem vira cliente
 * é decisão do Negócio, não da Máquina.
 *
 * O que a conversa carrega junto:
 *   · origem INSTAGRAM_DM
 *   · conversaId (a thread continua acessível a partir do lead)
 *   · postOrigemId (o conteúdo que trouxe a pessoa, quando conhecido)
 *   · automacaoId (a regra que iniciou a conversa, quando conhecida)
 */

const LINHAS = ["INNOBI", "MENTORIA", "SERVICOS"] as const;

const Schema = z.object({
  nome: z.string().trim().min(1).optional(),
  linhaInteresse: z.enum(LINHAS),
  valorEstimadoCentavos: z.number().int().positive().nullable().optional(),
  proximaAcao: z.string().trim().min(1),
  proximaAcaoEm: z.string().min(1),
  notas: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const dados = parsed.data;

  const erro = validarLeadAtivo({
    estagio: "LEAD",
    proximaAcao: dados.proximaAcao,
    proximaAcaoEm: dados.proximaAcaoEm,
  });
  if (erro) return NextResponse.json({ error: erro }, { status: 422 });

  const conversa = await prisma.igConversation.findUnique({ where: { id } });
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const username = conversa.igUsername.trim();
  const contato = username ? `@${username}` : conversa.igUserId;
  const nome = dados.nome?.trim() || username || conversa.igUserId;

  // Origem: o comentário mais antigo daquela pessoa diz de qual post ela veio.
  const primeiroComentario = conversa.igUserId
    ? await prisma.commentLog.findFirst({
        where: { senderId: conversa.igUserId },
        orderBy: { createdAt: "asc" },
        select: { igPostId: true, ruleId: true },
      })
    : null;

  // Já existe lead para este contato ou para esta conversa? Então não nasce outro.
  const existente = await prisma.lead.findFirst({
    where: { OR: [{ conversaId: id }, { contato }] },
  });

  if (existente) {
    const atualizado = await prisma.lead.update({
      where: { id: existente.id },
      data: {
        conversaId: existente.conversaId ?? id,
        postOrigemId: existente.postOrigemId ?? primeiroComentario?.igPostId ?? null,
        automacaoId: existente.automacaoId ?? primeiroComentario?.ruleId ?? null,
      },
    });
    return NextResponse.json({ lead: atualizado, criado: false }, { status: 200 });
  }

  // Cliente existente com o mesmo @ — vincula, mas não cria nada novo.
  const cliente = username
    ? await prisma.client.findFirst({
        where: { instagram: { in: [username, `@${username}`] } },
        select: { id: true },
      })
    : null;

  const lead = await prisma.lead.create({
    data: {
      nome,
      contato,
      estagio: "LEAD",
      origem: "INSTAGRAM_DM",
      linhaInteresse: dados.linhaInteresse,
      valorEstimadoCentavos: dados.valorEstimadoCentavos ?? null,
      proximaAcao: dados.proximaAcao,
      proximaAcaoEm: new Date(dados.proximaAcaoEm),
      notas: dados.notas?.trim() || null,
      conversaId: id,
      postOrigemId: primeiroComentario?.igPostId ?? null,
      automacaoId: primeiroComentario?.ruleId ?? null,
      clienteId: cliente?.id ?? null,
      estagioDesde: new Date(),
    },
  });

  return NextResponse.json({ lead, criado: true }, { status: 201 });
}
