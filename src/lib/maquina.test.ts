import { describe, expect, it } from "vitest";
import {
  atribuicaoVazia,
  classificarConversa,
  contarAguardandoResposta,
  diasDesde,
  ehOportunidade,
  fmtTaxa,
  montarAlertasMaquina,
  montarFunil,
  ordenarConteudos,
  taxa,
  type DadosAlertasMaquina,
  type StatusConversa,
} from "@/lib/maquina";

describe("classificarConversa", () => {
  it("chama de NOVA a conversa em que nunca respondi", () => {
    expect(classificarConversa({ estagioLead: null, ultimaMinha: false, minhas: 0 })).toBe("NOVA");
  });

  it("sem mensagem nenhuma também é NOVA", () => {
    expect(classificarConversa({ estagioLead: null, ultimaMinha: null, minhas: 0 })).toBe("NOVA");
  });

  it("aguarda minha resposta quando a última mensagem é do contato", () => {
    expect(classificarConversa({ estagioLead: null, ultimaMinha: false, minhas: 3 })).toBe(
      "AGUARDANDO_VOCE"
    );
  });

  it("aguarda o contato quando fui eu quem falou por último", () => {
    expect(classificarConversa({ estagioLead: null, ultimaMinha: true, minhas: 2 })).toBe(
      "AGUARDANDO_CONTATO"
    );
  });

  it("lead vence o estado da thread", () => {
    expect(classificarConversa({ estagioLead: "LEAD", ultimaMinha: false, minhas: 0 })).toBe("LEAD");
  });

  it("de qualificado em diante já é oportunidade", () => {
    expect(classificarConversa({ estagioLead: "NEGOCIACAO", ultimaMinha: true, minhas: 5 })).toBe(
      "OPORTUNIDADE"
    );
  });
});

describe("contarAguardandoResposta", () => {
  it("conta nova e aguardando você, nada mais", () => {
    const lista: StatusConversa[] = [
      "NOVA",
      "AGUARDANDO_VOCE",
      "AGUARDANDO_CONTATO",
      "LEAD",
      "OPORTUNIDADE",
    ];
    expect(contarAguardandoResposta(lista)).toBe(2);
  });
});

describe("ehOportunidade", () => {
  it("lead cru ainda não é oportunidade", () => {
    expect(ehOportunidade("LEAD")).toBe(false);
  });
  it("perdido não conta", () => {
    expect(ehOportunidade("PERDIDO")).toBe(false);
  });
  it("qualificado, proposta, negociação e fechado contam", () => {
    for (const e of ["QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "FECHADO"]) {
      expect(ehOportunidade(e)).toBe(true);
    }
  });
});

describe("montarFunil", () => {
  const base = {
    visualizacoes: 10_000,
    interacoes: 1_000,
    conversas: 100,
    leads: 10,
    oportunidades: 4,
    clientes: 1,
    receitaCentavos: 300_000,
  };

  it("calcula a conversão de cada etapa em relação à anterior", () => {
    const funil = montarFunil(base);
    expect(funil.find((e) => e.chave === "interacoes")?.taxa).toBeCloseTo(10);
    expect(funil.find((e) => e.chave === "conversas")?.taxa).toBeCloseTo(10);
    expect(funil.find((e) => e.chave === "leads")?.taxa).toBeCloseTo(10);
    expect(funil.find((e) => e.chave === "oportunidades")?.taxa).toBeCloseTo(40);
  });

  it("não dá taxa para a primeira etapa nem para receita", () => {
    const funil = montarFunil(base);
    expect(funil[0].taxa).toBeNull();
    expect(funil.find((e) => e.chave === "receita")?.taxa).toBeNull();
  });

  it("receita sem atribuição vira null e explica o motivo", () => {
    const funil = montarFunil({ ...base, receitaCentavos: null });
    const receita = funil.find((e) => e.chave === "receita")!;
    expect(receita.valor).toBeNull();
    expect(receita.fonte).toContain("desconhecida");
  });

  it("etapa anterior zerada não gera divisão por zero", () => {
    const funil = montarFunil({ ...base, conversas: 0, leads: 0 });
    expect(funil.find((e) => e.chave === "leads")?.taxa).toBeNull();
  });
});

describe("taxa e fmtTaxa", () => {
  it("protege contra divisão por zero", () => {
    expect(taxa(3, 0)).toBeNull();
  });
  it("formata em pt-BR", () => {
    expect(fmtTaxa(12.34)).toBe("12,3%");
  });
  it("valor muito pequeno não vira 0,0%", () => {
    expect(fmtTaxa(0.02)).toBe("<0,1%");
  });
  it("ausência de dado é traço", () => {
    expect(fmtTaxa(null)).toBe("—");
  });
});

describe("ordenarConteudos", () => {
  function conteudo(nome: string, leads: number, interacoes: number) {
    return {
      nome,
      atribuicao: { ...atribuicaoVazia(), leads },
      interacoes,
      alcance: 0,
    };
  }

  it("ordena pela métrica de negócio escolhida", () => {
    const lista = [conteudo("a", 1, 900), conteudo("b", 5, 10), conteudo("c", 0, 5000)];
    expect(ordenarConteudos(lista, "leads").map((c) => c.nome)).toEqual(["b", "a", "c"]);
  });

  it("desempata por interações para a ordem não dançar", () => {
    const lista = [conteudo("a", 0, 10), conteudo("b", 0, 900)];
    expect(ordenarConteudos(lista, "leads").map((c) => c.nome)).toEqual(["b", "a"]);
  });
});

describe("montarAlertasMaquina", () => {
  const limpo: DadosAlertasMaquina = {
    aguardandoResposta: 0,
    leadsNaoTratados: [],
    agendadosVencidos: [],
    diasSemPublicar: 1,
    diasSemSincronizar: 0,
    instagramConectado: true,
    automacoesSemExecucao: 0,
  };

  it("não inventa alerta quando está tudo em dia", () => {
    expect(montarAlertasMaquina(limpo)).toHaveLength(0);
  });

  it("integração caída é o alerta mais grave", () => {
    const alertas = montarAlertasMaquina({
      ...limpo,
      instagramConectado: false,
      aguardandoResposta: 3,
    });
    expect(alertas[0].id).toBe("integracao-instagram");
    expect(alertas[0].severidade).toBe("URGENTE");
  });

  it("conversa parada e agendado vencido entram como urgentes", () => {
    const alertas = montarAlertasMaquina({
      ...limpo,
      aguardandoResposta: 2,
      agendadosVencidos: [{ id: "p1", titulo: "Reels de IA", dias: 3 }],
    });
    expect(alertas.map((a) => a.id)).toContain("conversas-aguardando");
    expect(alertas.map((a) => a.id)).toContain("agendado-p1");
    expect(alertas.every((a) => a.severidade === "URGENTE")).toBe(true);
  });

  it("silêncio de conteúdo só vira alerta depois do limiar", () => {
    expect(montarAlertasMaquina({ ...limpo, diasSemPublicar: 6 })).toHaveLength(0);
    expect(montarAlertasMaquina({ ...limpo, diasSemPublicar: 7 })[0].id).toBe("sem-publicar");
  });

  it("urgente sempre vem antes de atenção e de info", () => {
    const alertas = montarAlertasMaquina({
      ...limpo,
      aguardandoResposta: 1,
      diasSemPublicar: 30,
      automacoesSemExecucao: 4,
    });
    expect(alertas.map((a) => a.severidade)).toEqual(["URGENTE", "ATENCAO", "INFO"]);
  });
});

describe("diasDesde", () => {
  it("conta dias inteiros em UTC", () => {
    const agora = new Date("2026-08-24T10:00:00Z");
    expect(diasDesde("2026-08-20T23:00:00Z", agora)).toBe(4);
  });

  it("mesmo dia é zero", () => {
    const agora = new Date("2026-08-24T23:00:00Z");
    expect(diasDesde("2026-08-24T01:00:00Z", agora)).toBe(0);
  });
});
