import { describe, it, expect } from "vitest";
import {
  AGENTES_DA_ETAPA,
  ETAPAS_PIPELINE,
  escopoParaTexto,
  etapaAposAlteracao,
  isEtapa,
  podePublicarSozinha,
  proximaEtapa,
  statusDaEtapa,
  textoParaEscopo,
} from "./etapas";
import {
  LIMIAR_REPETICAO,
  SCORE_MINIMO,
  feedbackParaAprendizado,
  filtrarRepetidas,
  mediaScore,
  montarContextoMemoria,
  selecionarMelhores,
  similaridade,
  type IdeiaCandidata,
} from "./memoria";

// ─── Etapas ──────────────────────────────────────────────────────────────────

describe("statusDaEtapa", () => {
  it("mapeia produção para RASCUNHO e mantém os literais", () => {
    expect(statusDaEtapa("IDEIA")).toBe("IDEIA");
    expect(statusDaEtapa("SELECIONADA")).toBe("RASCUNHO");
    expect(statusDaEtapa("COPY")).toBe("RASCUNHO");
    expect(statusDaEtapa("AGUARDANDO_APROVACAO")).toBe("RASCUNHO");
    expect(statusDaEtapa("AGENDADO")).toBe("AGENDADO");
    expect(statusDaEtapa("PUBLICADO")).toBe("PUBLICADO");
    expect(statusDaEtapa("ANALISE")).toBe("PUBLICADO");
  });
});

describe("proximaEtapa", () => {
  it("percorre a produção até a aprovação", () => {
    expect(proximaEtapa("SELECIONADA")).toBe("COPY");
    expect(proximaEtapa("COPY")).toBe("DESIGN");
    expect(proximaEtapa("DESIGN")).toBe("REVISAO");
    expect(proximaEtapa("REVISAO")).toBe("AGUARDANDO_APROVACAO");
  });

  it("não avança sozinha da aprovação — isso é clique seu", () => {
    expect(proximaEtapa("AGUARDANDO_APROVACAO")).toBeNull();
  });

  it("segue depois de agendado", () => {
    expect(proximaEtapa("AGENDADO")).toBe("PUBLICADO");
    expect(proximaEtapa("PUBLICADO")).toBe("ANALISE");
    expect(proximaEtapa("ANALISE")).toBeNull();
  });
});

describe("AGENTES_DA_ETAPA", () => {
  it("toda etapa de produção tem agente e toda etapa com agente tem próxima", () => {
    for (const [etapa, agentes] of Object.entries(AGENTES_DA_ETAPA)) {
      expect(agentes!.length).toBeGreaterThan(0);
      expect(isEtapa(etapa)).toBe(true);
      expect(proximaEtapa(etapa as never)).not.toBeNull();
    }
  });

  it("o pipeline visual lista as colunas na ordem e sem REPROVADO", () => {
    expect(ETAPAS_PIPELINE[0]).toBe("IDEIA");
    expect(ETAPAS_PIPELINE).not.toContain("REPROVADO");
  });
});

describe("modo", () => {
  it("só AUTOPILOT publica sozinha", () => {
    expect(podePublicarSozinha("MANUAL")).toBe(false);
    expect(podePublicarSozinha("COPILOTO")).toBe(false);
    expect(podePublicarSozinha("AUTOPILOT")).toBe(true);
  });
});

describe("escopo da alteração", () => {
  it("faz ida e volta do formato gravado", () => {
    expect(escopoParaTexto({ tipo: "SLIDE", ordem: 3 })).toBe("SLIDE:3");
    expect(textoParaEscopo("SLIDE:3")).toEqual({ tipo: "SLIDE", ordem: 3 });
    expect(textoParaEscopo("COPY")).toEqual({ tipo: "COPY" });
    expect(textoParaEscopo("qualquer coisa")).toEqual({ tipo: "POST" });
  });

  it("volta para a etapa mínima — não recria o carrossel inteiro", () => {
    expect(etapaAposAlteracao({ tipo: "SLIDE", ordem: 3 })).toBe("COPY");
    expect(etapaAposAlteracao({ tipo: "VISUAL" })).toBe("COPY");
    expect(etapaAposAlteracao({ tipo: "COPY" })).toBe("SELECIONADA");
    expect(etapaAposAlteracao({ tipo: "LEGENDA" })).toBe("REVISAO");
    expect(etapaAposAlteracao({ tipo: "POST" })).toBe("SELECIONADA");
  });
});

// ─── Score e seleção ─────────────────────────────────────────────────────────

function ideia(over: Partial<IdeiaCandidata> & { id: string }): IdeiaCandidata {
  return {
    titulo: `Ideia ${over.id}`,
    tema: "automação",
    objetivo: "ALCANCE",
    score: { viralidade: 8, fit: 8, producao: 8, valor: 8, conversao: 8 },
    ...over,
  };
}

describe("mediaScore", () => {
  it("é a média simples, com uma casa", () => {
    expect(mediaScore({ viralidade: 9, fit: 10, producao: 8, valor: 9, conversao: 7 })).toBe(8.6);
  });

  it("não deixa nota estourar a escala", () => {
    expect(mediaScore({ viralidade: 15, fit: -3, producao: 10, valor: 10, conversao: 10 })).toBe(8);
  });
});

describe("selecionarMelhores", () => {
  it("pega uma por objetivo na ordem alcance → autoridade → conversão", () => {
    const r = selecionarMelhores([
      ideia({ id: "c", objetivo: "CONVERSAO" }),
      ideia({ id: "a", objetivo: "ALCANCE" }),
      ideia({ id: "b", objetivo: "AUTORIDADE" }),
    ]);
    expect(r.map((i) => i.objetivo)).toEqual(["ALCANCE", "AUTORIDADE", "CONVERSAO"]);
  });

  it("descarta o que fica abaixo do mínimo — produz menos, nunca pior", () => {
    const fraca = { viralidade: 5, fit: 5, producao: 5, valor: 5, conversao: 5 };
    const r = selecionarMelhores([
      ideia({ id: "boa", objetivo: "ALCANCE" }),
      ideia({ id: "fraca", objetivo: "AUTORIDADE", score: fraca }),
    ]);
    expect(r.map((i) => i.id)).toEqual(["boa"]);
    expect(mediaScore(fraca)).toBeLessThan(SCORE_MINIMO);
  });

  it("devolve vazio quando não há ideia boa — zero post é resposta válida", () => {
    const fraca = { viralidade: 4, fit: 4, producao: 4, valor: 4, conversao: 4 };
    expect(selecionarMelhores([ideia({ id: "x", score: fraca })])).toEqual([]);
  });

  it("preenche vaga com segunda ideia do mesmo objetivo se for boa", () => {
    const r = selecionarMelhores([
      ideia({ id: "a1", objetivo: "ALCANCE" }),
      ideia({ id: "a2", objetivo: "ALCANCE", score: { viralidade: 9, fit: 9, producao: 9, valor: 9, conversao: 9 } }),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe("a2"); // a melhor nota vem primeiro dentro do objetivo
  });

  it("respeita o limite", () => {
    const muitas = ["a", "b", "c", "d", "e"].map((id) => ideia({ id }));
    expect(selecionarMelhores(muitas, 2)).toHaveLength(2);
  });
});

// ─── Anti-repetição ──────────────────────────────────────────────────────────

describe("similaridade", () => {
  it("é 1 para o mesmo texto e 0 sem palavras em comum", () => {
    expect(similaridade("automação para empresas", "automação para empresas")).toBe(1);
    expect(similaridade("automação para empresas", "receita de bolo")).toBe(0);
  });

  it("ignora acentos, caixa e palavras vazias", () => {
    expect(similaridade("Automação de Vendas", "automacao DE vendas")).toBe(1);
  });
});

describe("filtrarRepetidas", () => {
  const publicados = [
    {
      id: "p1",
      tituloInterno: "5 automações que eu colocaria numa empresa hoje",
      tema: "automação empresas",
      caption: null,
      palavraChave: null,
      postedAt: new Date(),
    },
  ];

  it("descarta ideia parecida com post recente e explica com quem", () => {
    const { aceitas, descartadas } = filtrarRepetidas(
      [{ titulo: "5 automações para colocar na sua empresa hoje", tema: "automação empresas" }],
      publicados
    );
    expect(aceitas).toEqual([]);
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0].parecidaCom).toBe("p1");
    expect(descartadas[0].similaridade).toBeGreaterThanOrEqual(LIMIAR_REPETICAO);
  });

  it("aceita ideia de tema diferente", () => {
    const { aceitas } = filtrarRepetidas(
      [{ titulo: "Como eu usaria Claude Code para construir um SaaS", tema: "claude code" }],
      publicados
    );
    expect(aceitas).toHaveLength(1);
  });

  it("ignora posts antigos demais para contar como repetição", () => {
    const antigo = [{ ...publicados[0], postedAt: new Date(Date.now() - 90 * 86_400_000) }];
    const { aceitas } = filtrarRepetidas(
      [{ titulo: "5 automações que eu colocaria numa empresa hoje", tema: "automação empresas" }],
      antigo
    );
    expect(aceitas).toHaveLength(1);
  });
});

describe("montarContextoMemoria", () => {
  it("põe aprendizados pesados primeiro e lista o publicado", () => {
    const ctx = montarContextoMemoria(
      [{ id: "1", tituloInterno: "Post X", tema: "mcp", caption: null, palavraChave: "MCP", postedAt: new Date() }],
      [
        { texto: "leve", origem: "FEEDBACK", tags: "", peso: 1 },
        { texto: "pesado", origem: "PERFORMANCE", tags: "hook", peso: 5 },
      ]
    );
    expect(ctx.indexOf("pesado")).toBeLessThan(ctx.indexOf("leve"));
    expect(ctx).toContain("Post X");
    expect(ctx).toContain('CTA "MCP"');
  });

  it("é vazio sem memória nenhuma", () => {
    expect(montarContextoMemoria([], [])).toBe("");
  });
});

describe("feedbackParaAprendizado", () => {
  it("deduz tags do escopo e do texto", () => {
    const a = feedbackParaAprendizado("Hook fraco e visual genérico", "SLIDE:1");
    expect(a?.tags.split(",")).toEqual(expect.arrayContaining(["visual", "hook"]));
  });

  it("descarta motivo vazio", () => {
    expect(feedbackParaAprendizado("  ", "POST")).toBeNull();
  });
});
