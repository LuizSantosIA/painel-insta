import { describe, it, expect } from "vitest";
import { validarLeadAtivo, isAtrasado } from "./pipeline";

describe("validarLeadAtivo", () => {
  it("bloqueia LEAD sem próxima ação e sem data", () => {
    expect(validarLeadAtivo({ estagio: "LEAD", proximaAcao: null, proximaAcaoEm: null })).toBeTruthy();
  });

  it("bloqueia QUALIFICADO com texto mas sem data", () => {
    expect(validarLeadAtivo({ estagio: "QUALIFICADO", proximaAcao: "Ligar", proximaAcaoEm: null })).toBeTruthy();
  });

  it("bloqueia PROPOSTA_ENVIADA com data mas sem texto", () => {
    expect(validarLeadAtivo({ estagio: "PROPOSTA_ENVIADA", proximaAcao: "", proximaAcaoEm: new Date() })).toBeTruthy();
  });

  it("bloqueia string só com espaços como próxima ação", () => {
    expect(validarLeadAtivo({ estagio: "NEGOCIACAO", proximaAcao: "   ", proximaAcaoEm: new Date() })).toBeTruthy();
  });

  it("permite lead ativo com ação e data preenchidos", () => {
    expect(validarLeadAtivo({ estagio: "LEAD", proximaAcao: "Ligar", proximaAcaoEm: new Date() })).toBeNull();
  });

  it("permite QUALIFICADO com ação e data", () => {
    expect(validarLeadAtivo({ estagio: "QUALIFICADO", proximaAcao: "Enviar proposta", proximaAcaoEm: new Date() })).toBeNull();
  });

  it("permite FECHADO sem próxima ação", () => {
    expect(validarLeadAtivo({ estagio: "FECHADO", proximaAcao: null, proximaAcaoEm: null })).toBeNull();
  });

  it("permite PERDIDO sem próxima ação", () => {
    expect(validarLeadAtivo({ estagio: "PERDIDO", proximaAcao: null, proximaAcaoEm: null })).toBeNull();
  });

  it("permite FECHADO mesmo com campos vazios", () => {
    expect(validarLeadAtivo({ estagio: "FECHADO", proximaAcao: "", proximaAcaoEm: undefined })).toBeNull();
  });
});

describe("isAtrasado", () => {
  it("retorna true para data claramente no passado", () => {
    expect(isAtrasado(new Date("2020-01-01T00:00:00Z"))).toBe(true);
  });

  it("retorna false para data claramente no futuro", () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    expect(isAtrasado(future)).toBe(false);
  });

  it("retorna false para null", () => {
    expect(isAtrasado(null)).toBe(false);
  });

  it("retorna false para undefined", () => {
    expect(isAtrasado(undefined)).toBe(false);
  });

  it("aceita string ISO como input", () => {
    expect(isAtrasado("2020-06-15T00:00:00.000Z")).toBe(true);
  });
});

// ─── Pipeline operacional ────────────────────────────────────────────────────

import {
  DIAS_PARADO_ATENCAO,
  DIAS_PARADO_RISCO,
  calcResumoPipeline,
  diasNoEstagio,
  fmtTempoNoEstagio,
  labelMotivoPerda,
  tomTempoParado,
} from "./pipeline";

function diasAtras(n: number): Date {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate() - n, 12));
}

describe("diasNoEstagio", () => {
  it("devolve null sem carimbo — não inventa data para leads antigos", () => {
    expect(diasNoEstagio(null)).toBeNull();
    expect(diasNoEstagio(undefined)).toBeNull();
  });

  it("conta zero no mesmo dia", () => {
    expect(diasNoEstagio(diasAtras(0))).toBe(0);
  });

  it("conta os dias corridos", () => {
    expect(diasNoEstagio(diasAtras(6))).toBe(6);
  });

  it("nunca devolve negativo para data futura", () => {
    const amanha = new Date(Date.now() + 86_400_000);
    expect(diasNoEstagio(amanha)).toBe(0);
  });
});

describe("tomTempoParado", () => {
  it("é neutro sem informação", () => {
    expect(tomTempoParado(null)).toBe("NEUTRO");
  });

  it("é neutro antes do limiar de atenção", () => {
    expect(tomTempoParado(DIAS_PARADO_ATENCAO - 1)).toBe("NEUTRO");
  });

  it("vira atenção no limiar", () => {
    expect(tomTempoParado(DIAS_PARADO_ATENCAO)).toBe("ATENCAO");
  });

  it("vira risco no limiar maior", () => {
    expect(tomTempoParado(DIAS_PARADO_RISCO)).toBe("RISCO");
    expect(tomTempoParado(DIAS_PARADO_RISCO + 30)).toBe("RISCO");
  });
});

describe("fmtTempoNoEstagio", () => {
  it("mostra traço sem informação", () => {
    expect(fmtTempoNoEstagio(null)).toBe("—");
  });

  it("usa Hoje, singular e plural", () => {
    expect(fmtTempoNoEstagio(0)).toBe("Hoje");
    expect(fmtTempoNoEstagio(1)).toBe("1 dia");
    expect(fmtTempoNoEstagio(9)).toBe("9 dias");
  });
});

describe("calcResumoPipeline", () => {
  it("soma e conta apenas estágios ativos", () => {
    const r = calcResumoPipeline([
      { estagio: "LEAD", valorEstimadoCentavos: 100000 },
      { estagio: "NEGOCIACAO", valorEstimadoCentavos: 300000 },
      { estagio: "FECHADO", valorEstimadoCentavos: 900000 },
      { estagio: "PERDIDO", valorEstimadoCentavos: 500000 },
    ]);
    expect(r.quantidade).toBe(2);
    expect(r.totalCentavos).toBe(400000);
  });

  it("calcula ticket médio só sobre quem tem valor", () => {
    const r = calcResumoPipeline([
      { estagio: "LEAD", valorEstimadoCentavos: 100000 },
      { estagio: "LEAD", valorEstimadoCentavos: 300000 },
      { estagio: "LEAD", valorEstimadoCentavos: null },
    ]);
    expect(r.quantidade).toBe(3);
    expect(r.ticketMedioCentavos).toBe(200000);
  });

  it("devolve ticket médio null quando ninguém tem valor", () => {
    const r = calcResumoPipeline([{ estagio: "LEAD", valorEstimadoCentavos: null }]);
    expect(r.ticketMedioCentavos).toBeNull();
  });

  it("deixa o ponderado null enquanto não houver probabilidade", () => {
    const r = calcResumoPipeline([{ estagio: "LEAD", valorEstimadoCentavos: 100000 }]);
    expect(r.ponderadoCentavos).toBeNull();
  });

  it("zera com pipeline vazio", () => {
    expect(calcResumoPipeline([])).toEqual({
      totalCentavos: 0,
      quantidade: 0,
      ticketMedioCentavos: null,
      ponderadoCentavos: null,
    });
  });
});

describe("labelMotivoPerda", () => {
  it("traduz os motivos conhecidos", () => {
    expect(labelMotivoPerda("SEM_RESPOSTA")).toBe("Sem resposta");
  });

  it("devolve null sem motivo", () => {
    expect(labelMotivoPerda(null)).toBeNull();
  });

  it("devolve o valor cru se for desconhecido", () => {
    expect(labelMotivoPerda("XPTO")).toBe("XPTO");
  });
});
