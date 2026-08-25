import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { carregarMaquina, type ConteudoMaquina } from "@/lib/maquina-dados";
import { STATUS_CONTEUDO } from "@/lib/maquina";
import { MEDIA_TYPES } from "@/lib/constants";

/** A central de conteúdo: o pipeline editorial inteiro, já com atribuição. */
export interface ConteudoLista {
  conteudos: ConteudoMaquina[];
  porStatus: Record<string, number>;
}

export async function GET() {
  const { conteudos } = await carregarMaquina();

  const porStatus: Record<string, number> = {};
  for (const s of STATUS_CONTEUDO) porStatus[s] = 0;
  for (const c of conteudos) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;

  const resposta: ConteudoLista = { conteudos, porStatus };
  return NextResponse.json(resposta);
}

const CriarSchema = z.object({
  caption: z.string().min(1, "Escreva do que é o conteúdo"),
  mediaType: z.enum(MEDIA_TYPES).default("REELS"),
  category: z.string().nullable().optional(),
  // Ideia e rascunho nascem sem data; agendado exige uma.
  status: z.enum(["IDEIA", "RASCUNHO", "AGENDADO"]).default("IDEIA"),
  agendadoPara: z.string().nullable().optional(),
});

/**
 * Cria um conteúdo planejado. Publicado não entra por aqui — quem publica é o
 * Instagram, e o post chega pelo sync.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = CriarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { caption, mediaType, category, status, agendadoPara } = parsed.data;

  if (status === "AGENDADO" && !agendadoPara) {
    return NextResponse.json(
      { errors: { agendadoPara: ["Informe a data para agendar"] } },
      { status: 422 }
    );
  }

  const data = agendadoPara ? new Date(agendadoPara) : null;

  const conteudo = await prisma.post.create({
    data: {
      caption,
      mediaType,
      category: category?.trim() || null,
      status,
      agendadoPara: data,
      // postedAt posiciona o conteúdo no calendário mesmo antes de ir ao ar.
      postedAt: data ?? new Date(),
      source: "manual",
    },
  });

  return NextResponse.json(conteudo, { status: 201 });
}
