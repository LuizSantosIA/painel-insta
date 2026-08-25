import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mesParaDate, parseDataUTC, ultimoDiaDoMes } from "@/lib/financeiro";
import { INCLUDE_CLIENTE, mesCorrente, toReceitaDTO } from "@/lib/financeiro-server";

/**
 * Fechar uma oportunidade — Pipeline → Financeiro, num único evento comercial.
 *
 * A oportunidade vira FECHADO e as receitas correspondentes nascem já vinculadas
 * a ela (leadId) e ao mesmo cliente, dentro de uma transação: ou tudo acontece,
 * ou nada acontece. Não existe recadastro manual e não existem dois registros
 * do mesmo negócio.
 *
 * Idempotência: se a oportunidade já tem receita gerada, um novo fechamento não
 * cria outra. O vínculo leadId é a trava — Pipeline e Financeiro enxergam o
 * mesmo fato, então perguntar "já gerou?" é uma consulta, não um palpite.
 */

const Schema = z.object({
  /** Entrada única (setup, projeto, implementação). */
  pontual: z
    .object({
      descricao: z.string().min(1),
      valorCentavos: z.number().int().positive(),
      linha: z.enum(["INNOBI", "MENTORIA", "SERVICOS"]),
      competencia: z.string().regex(/^\d{4}-\d{2}$/),
      vencimento: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  /** Mensalidade contratada. */
  recorrente: z
    .object({
      descricao: z.string().min(1),
      valorCentavos: z.number().int().positive(),
      linha: z.enum(["INNOBI", "MENTORIA", "SERVICOS"]),
      competencia: z.string().regex(/^\d{4}-\d{2}$/),
      vencimento: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

type Entrada = z.infer<typeof Schema>["pontual"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const encontrado = await prisma.lead.findUnique({ where: { id } });
  if (!encontrado) {
    return NextResponse.json({ error: "Oportunidade não encontrada" }, { status: 404 });
  }
  // Const separada: dentro do closure de dadosReceita o TypeScript perderia o
  // narrowing do findUnique e trataria lead como possivelmente null.
  const lead = encontrado;

  const jaGeradas = await prisma.receita.findMany({
    where: { leadId: id },
    include: INCLUDE_CLIENTE,
  });

  const querGerar = Boolean(parsed.data.pontual || parsed.data.recorrente);

  // Já existe receita deste negócio: fecha (ou confirma o fechamento) sem duplicar.
  if (jaGeradas.length > 0 && querGerar) {
    const atualizado =
      lead.estagio === "FECHADO"
        ? lead
        : await prisma.lead.update({
            where: { id },
            data: { estagio: "FECHADO", estagioDesde: new Date() },
          });

    return NextResponse.json(
      {
        lead: atualizado,
        receitas: jaGeradas.map(toReceitaDTO),
        duplicadaEvitada: true,
      },
      { status: 200 }
    );
  }

  const agora = new Date();
  const mesPadrao = mesCorrente(agora);

  function dadosReceita(entrada: NonNullable<Entrada>, tipo: "PONTUAL" | "RECORRENTE") {
    const competencia = mesParaDate(entrada.competencia || mesPadrao);
    return {
      descricao: entrada.descricao,
      valorCentavos: entrada.valorCentavos,
      linha: entrada.linha,
      tipo,
      // Negócio fechado é receita contratada, não uma previsão.
      status: "CONFIRMADA",
      clienteId: lead.clienteId,
      leadId: lead.id,
      competencia,
      vencimento: entrada.vencimento
        ? parseDataUTC(entrada.vencimento)
        : ultimoDiaDoMes(competencia),
      atualizadoEm: agora,
    };
  }

  const criadas = await prisma.$transaction(async (tx) => {
    const receitas = [];

    if (parsed.data.pontual) {
      receitas.push(
        await tx.receita.create({
          data: dadosReceita(parsed.data.pontual, "PONTUAL"),
          include: INCLUDE_CLIENTE,
        })
      );
    }

    if (parsed.data.recorrente) {
      const criada = await tx.receita.create({
        data: dadosReceita(parsed.data.recorrente, "RECORRENTE"),
        include: INCLUDE_CLIENTE,
      });
      // A primeira competência é a origem do contrato — é o que permite lançar
      // os meses seguintes sem duplicar a mensalidade.
      receitas.push(
        await tx.receita.update({
          where: { id: criada.id },
          data: { contratoId: criada.id },
          include: INCLUDE_CLIENTE,
        })
      );
    }

    const atualizado = await tx.lead.update({
      where: { id },
      data: { estagio: "FECHADO", estagioDesde: new Date() },
    });

    return { receitas, lead: atualizado };
  });

  return NextResponse.json(
    {
      lead: criadas.lead,
      receitas: criadas.receitas.map(toReceitaDTO),
      duplicadaEvitada: false,
    },
    { status: 201 }
  );
}
