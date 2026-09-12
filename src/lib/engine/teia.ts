import { AGENTES, type Agente } from "./etapas";

/**
 * A teia dos agentes: quem existe, o que faz, de quem recebe e para quem entrega.
 * Puro — a tela só desenha. Os 11 agentes + dois nós que não são agentes mas
 * fecham o circuito: você (aprova) e a memória (aprende).
 */

export type NoId = Agente | "VOCE" | "MEMORIA";
export type TipoNo = "IA" | "CODIGO" | "PENDENTE" | "HUMANO" | "MEMORIA";

export interface NoTeia {
  id: NoId;
  label: string;
  tipo: TipoNo;
  papel: string;
  funcao: string;
  recebe: string;
  entrega: string;
  regra?: string;
  x: number;
  y: number;
}

export interface LigacaoTeia {
  de: NoId;
  para: NoId;
  /** fluxo = o post anda; dados = informação que alimenta */
  tipo: "fluxo" | "dados";
  label?: string;
}

export const LARGURA_TEIA = 1200;
export const ALTURA_TEIA = 640;

export const NOS_TEIA: NoTeia[] = [
  {
    id: "RADAR", label: "Radar", tipo: "IA",
    papel: "Encontra o que está funcionando",
    funcao: "Lê os links e temas que você cola, resume a fonte e explica por que aquele conteúdo funcionou — estrutura, gancho, formato.",
    recebe: "Links, temas e contexto seus", entrega: "Fontes resumidas para o Estrategista",
    regra: "Não raspa o Instagram (termos da Meta). Só lê o que você entrega.",
    x: 90, y: 110,
  },
  {
    id: "ESTRATEGISTA", label: "Estrategista", tipo: "IA",
    papel: "Escolhe o que vira post",
    funcao: "Pontua cada fonte em potencial viral, encaixe no nicho, autoridade e conversão. Descarta o que repete o que você já postou nos últimos 60 dias e escolhe até 3 ideias por dia, uma por objetivo.",
    recebe: "Fontes do Radar + memória editorial", entrega: "Ideias selecionadas com objetivo e tipo",
    regra: "Nota mínima 7. Sem ideia boa, não cria nada — nunca completa quota com conteúdo medíocre.",
    x: 300, y: 110,
  },
  {
    id: "VIRAL_ADAPTER", label: "Viral Adapter", tipo: "IA",
    papel: "Traduz o viral para o seu nicho",
    funcao: "Extrai a estrutura da referência (gancho, ritmo, viradas) e adapta ao seu público e à sua voz sem copiar o conteúdo.",
    recebe: "Ideia selecionada + fonte original", entrega: "Estrutura adaptada para o Copywriter",
    x: 520, y: 70,
  },
  {
    id: "COPYWRITER", label: "Copywriter", tipo: "IA",
    papel: "Escreve o carrossel",
    funcao: "Escreve slide a slide — headline, corpo, microcopy — mais a legenda e a palavra-chave do CTA. Ao pedir alteração de um slide, reescreve só aquele.",
    recebe: "Estrutura adaptada + aprendizados", entrega: "Roteiro dos slides, legenda e palavra-chave",
    regra: "Voz sua: direto, sem jargão vazio, sem promessa que não existe.",
    x: 740, y: 150,
  },
  {
    id: "DIRETOR_VISUAL", label: "Diretor Visual", tipo: "IA",
    papel: "Define como cada slide aparece",
    funcao: "Escolhe o layout de cada slide (gancho, texto, lista, destaque, CTA) dentro do sistema visual do post e escreve a direção visual.",
    recebe: "Roteiro dos slides", entrega: "Layout + direção por slide para o Gerador",
    x: 960, y: 70,
  },
  {
    id: "GERADOR", label: "Gerador Visual", tipo: "CODIGO",
    papel: "Renderiza as imagens",
    funcao: "Transforma cada slide em um PNG 1080×1350 usando os templates dos 4 sistemas visuais e salva no Blob com URL pública.",
    recebe: "Layout e direção de cada slide", entrega: "Imagem final de cada slide",
    regra: "Cada slide é gerado individualmente. Nunca uma imagem com todos juntos.",
    x: 1130, y: 150,
  },
  {
    id: "FACT_CHECKER", label: "Fact Checker", tipo: "IA",
    papel: "Confere o que foi afirmado",
    funcao: "Lista números, nomes e afirmações do post e marca o que não consegue confirmar. O que fica em dúvida vira alerta no checklist.",
    recebe: "Roteiro + legenda", entrega: "Verificações e alertas",
    regra: "Nunca inventa. Em dúvida, sinaliza.",
    x: 1130, y: 380,
  },
  {
    id: "LEAD_MAGNET", label: "Lead Magnet", tipo: "IA",
    papel: "Prepara a automação do CTA",
    funcao: "Se o post tem CTA, cria a automação de DM: palavra-chave, mensagem, link e trava de seguidor. Fica inativa até o post ser publicado.",
    recebe: "Legenda e palavra-chave", entrega: "AutoRule pronta (inativa)",
    regra: "Nunca publica CTA prometendo algo que não existe.",
    x: 910, y: 460,
  },
  {
    id: "REVISOR", label: "Revisor Final", tipo: "IA",
    papel: "Avalia antes de você",
    funcao: "Nota final do post: gancho, clareza, coerência com a voz, força do CTA. Aponta o que melhoraria e manda para a sua fila.",
    recebe: "Post completo + alertas do Fact Checker", entrega: "Nota e parecer → fila de aprovação",
    x: 690, y: 380,
  },
  {
    id: "VOCE", label: "Você", tipo: "HUMANO",
    papel: "Aprova, altera ou reprova",
    funcao: "A única decisão que a máquina não toma. Aprovar agenda no calendário. Pedir alteração devolve só o escopo pedido (um slide, o visual, a legenda). Reprovar com motivo ensina a máquina.",
    recebe: "Post revisado", entrega: "Decisão + motivo",
    regra: "Modo COPILOTO: nada é publicado sem você.",
    x: 470, y: 460,
  },
  {
    id: "PUBLICADOR", label: "Publicador", tipo: "CODIGO",
    papel: "Sobe para o Instagram",
    funcao: "Publica o carrossel pela API oficial (um container por slide → carrossel → publish), guarda o ID e ativa a automação de DM do Lead Magnet.",
    recebe: "Post aprovado no horário", entrega: "Post publicado + DM ativa",
    regra: "Só no seu botão. Em AUTOPILOT publicaria sozinho — e Autopilot fica desligado até você decidir.",
    x: 250, y: 380,
  },
  {
    id: "PERFORMANCE", label: "Performance", tipo: "PENDENTE",
    papel: "Mede e aprende (a construir)",
    funcao: "Vai coletar alcance, salvamentos, compartilhamentos e DMs em 24h, 72h e 7 dias e transformar o que funcionou em aprendizados.",
    recebe: "Posts publicados", entrega: "Snapshots de métrica + aprendizados",
    regra: "Tabela pronta, coletor ainda não implementado.",
    x: 90, y: 520,
  },
  {
    id: "MEMORIA", label: "Memória editorial", tipo: "MEMORIA",
    papel: "O que a máquina já sabe",
    funcao: "Posts publicados nos últimos 60 dias (para não repetir) + aprendizados vindos do seu feedback e da performance. Entra nos prompts do Estrategista e do Copywriter.",
    recebe: "Feedback seu + métricas", entrega: "Contexto para os agentes",
    x: 520, y: 280,
  },
];

export const LIGACOES_TEIA: LigacaoTeia[] = [
  { de: "RADAR", para: "ESTRATEGISTA", tipo: "fluxo", label: "fontes" },
  { de: "ESTRATEGISTA", para: "VIRAL_ADAPTER", tipo: "fluxo", label: "ideia" },
  { de: "VIRAL_ADAPTER", para: "COPYWRITER", tipo: "fluxo", label: "estrutura" },
  { de: "COPYWRITER", para: "DIRETOR_VISUAL", tipo: "fluxo", label: "roteiro" },
  { de: "DIRETOR_VISUAL", para: "GERADOR", tipo: "fluxo", label: "layout" },
  { de: "GERADOR", para: "FACT_CHECKER", tipo: "fluxo", label: "slides" },
  { de: "FACT_CHECKER", para: "LEAD_MAGNET", tipo: "fluxo", label: "verificado" },
  { de: "LEAD_MAGNET", para: "REVISOR", tipo: "fluxo", label: "CTA pronto" },
  { de: "REVISOR", para: "VOCE", tipo: "fluxo", label: "aprovação" },
  { de: "VOCE", para: "PUBLICADOR", tipo: "fluxo", label: "aprovado" },
  { de: "PUBLICADOR", para: "PERFORMANCE", tipo: "fluxo", label: "publicado" },
  { de: "PERFORMANCE", para: "MEMORIA", tipo: "dados", label: "aprendizados" },
  { de: "VOCE", para: "MEMORIA", tipo: "dados", label: "feedback" },
  { de: "VOCE", para: "COPYWRITER", tipo: "dados", label: "alterar slide" },
  { de: "MEMORIA", para: "ESTRATEGISTA", tipo: "dados", label: "não repetir" },
  { de: "MEMORIA", para: "COPYWRITER", tipo: "dados", label: "voz" },
  { de: "PUBLICADOR", para: "LEAD_MAGNET", tipo: "dados", label: "ativa DM" },
];

export const LABEL_TIPO_NO: Record<TipoNo, string> = {
  IA: "agente de IA",
  CODIGO: "determinístico",
  PENDENTE: "a construir",
  HUMANO: "você",
  MEMORIA: "memória",
};

/** Todo agente do pipeline precisa estar na teia. */
export function agentesForaDaTeia(): Agente[] {
  const ids = new Set(NOS_TEIA.map((n) => n.id));
  return AGENTES.filter((a) => !ids.has(a));
}

/** Ligações que apontam para nós inexistentes. */
export function ligacoesQuebradas(): LigacaoTeia[] {
  const ids = new Set(NOS_TEIA.map((n) => n.id));
  return LIGACOES_TEIA.filter((l) => !ids.has(l.de) || !ids.has(l.para));
}

export function vizinhos(id: NoId): { entram: LigacaoTeia[]; saem: LigacaoTeia[] } {
  return {
    entram: LIGACOES_TEIA.filter((l) => l.para === id),
    saem: LIGACOES_TEIA.filter((l) => l.de === id),
  };
}
