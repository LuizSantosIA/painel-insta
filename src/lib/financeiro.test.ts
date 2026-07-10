import { describe, it, expect } from "vitest";
import {
  calcMRR,
  calcReceitaPontual,
  calcAReceber,
  calcRunway,
  calcMRRPorLinha,
  calcVariacao,
  parseBRL,
  mesParaDate,
} from "./financeiro";

// ─── MRR ─────────────────────────────────────────────────────────────────────

describe("calcMRR", () => {
  it("soma apenas RECORRENTE com status CONFIRMADA ou RECEBIDA", () => {
    const r = [
      { tipo: "RECORRENTE", status: "CONFIRMADA",   valorCentavos: 100_000 },
      { tipo: "RECORRENTE", status: "RECEBIDA",     valorCentavos: 200_000 },
      { tipo: "RECORRENTE", status: "PREVISTA",     valorCentavos:  50_000 }, // exclui
      { tipo: "RECORRENTE", status: "INADIMPLENTE", valorCentavos:  30_000 }, // exclui
      { tipo: "PONTUAL",    status: "RECEBIDA",     valorCentavos: 999_900 }, // exclui
    ];
    expect(calcMRR(r)).toBe(300_000);
  });

  it("retorna 0 para lista vazia", () => {
    expect(calcMRR([])).toBe(0);
  });

  it("receita pontual NÃO contamina o MRR", () => {
    const r = [
      { tipo: "RECORRENTE", status: "RECEBIDA", valorCentavos: 100_000 },
      { tipo: "PONTUAL",    status: "RECEBIDA", valorCentavos: 500_000 },
    ];
    expect(calcMRR(r)).toBe(100_000);
    expect(calcReceitaPontual(r)).toBe(500_000);
  });
});

// ─── MRR por linha ───────────────────────────────────────────────────────────

describe("calcMRRPorLinha", () => {
  it("segrega por linha corretamente", () => {
    const r = [
      { tipo: "RECORRENTE", status: "RECEBIDA",  valorCentavos: 100_000, linha: "INNOBI"   },
      { tipo: "RECORRENTE", status: "CONFIRMADA",valorCentavos:  50_000, linha: "MENTORIA" },
      { tipo: "RECORRENTE", status: "RECEBIDA",  valorCentavos:  80_000, linha: "SERVICOS" },
      { tipo: "PONTUAL",    status: "RECEBIDA",  valorCentavos: 999_000, linha: "INNOBI"   }, // exclui
    ];
    const result = calcMRRPorLinha(r);
    expect(result.INNOBI).toBe(100_000);
    expect(result.MENTORIA).toBe(50_000);
    expect(result.SERVICOS).toBe(80_000);
  });
});

// ─── A receber ────────────────────────────────────────────────────────────────

describe("calcAReceber", () => {
  it("soma apenas CONFIRMADA", () => {
    const r = [
      { tipo: "RECORRENTE", status: "CONFIRMADA", valorCentavos: 200_000 },
      { tipo: "PONTUAL",    status: "CONFIRMADA", valorCentavos: 100_000 },
      { tipo: "RECORRENTE", status: "RECEBIDA",   valorCentavos: 999_000 }, // exclui
    ];
    expect(calcAReceber(r)).toBe(300_000);
  });
});

// ─── Runway ──────────────────────────────────────────────────────────────────

describe("calcRunway", () => {
  it("retorna null com menos de 3 meses", () => {
    expect(calcRunway(1_000_000, [])).toBeNull();
    expect(calcRunway(1_000_000, [{ totalCentavos: 100_000 }])).toBeNull();
    expect(
      calcRunway(1_000_000, [{ totalCentavos: 100_000 }, { totalCentavos: 100_000 }]),
    ).toBeNull();
  });

  it("calcula corretamente com 3 meses", () => {
    // saldo 300k, média 100k/mês → 3 meses
    expect(
      calcRunway(300_000, [
        { totalCentavos: 90_000 },
        { totalCentavos: 100_000 },
        { totalCentavos: 110_000 },
      ]),
    ).toBe(3);
  });

  it("arredonda para baixo (floor)", () => {
    // saldo 250k, média 100k → 2.5 → 2
    expect(
      calcRunway(250_000, [
        { totalCentavos: 100_000 },
        { totalCentavos: 100_000 },
        { totalCentavos: 100_000 },
      ]),
    ).toBe(2);
  });

  it("retorna null quando média de despesas é zero", () => {
    expect(
      calcRunway(500_000, [
        { totalCentavos: 0 },
        { totalCentavos: 0 },
        { totalCentavos: 0 },
      ]),
    ).toBeNull();
  });
});

// ─── Variação % ──────────────────────────────────────────────────────────────

describe("calcVariacao", () => {
  it("calcula variação percentual", () => {
    expect(calcVariacao(110_000, 100_000)).toBeCloseTo(10);
    expect(calcVariacao(90_000,  100_000)).toBeCloseTo(-10);
  });

  it("retorna null quando anterior = 0", () => {
    expect(calcVariacao(50_000, 0)).toBeNull();
  });
});

// ─── parseBRL ─────────────────────────────────────────────────────────────────

describe("parseBRL", () => {
  it("converte entrada do usuário para centavos", () => {
    expect(parseBRL("1997")).toBe(199_700);
    expect(parseBRL("1997.50")).toBe(199_750);
    expect(parseBRL("1997,50")).toBe(199_750);
    expect(parseBRL("R$ 1.997,00")).toBe(199_700);
    expect(parseBRL("")).toBe(0);
  });
});

// ─── mesParaDate ──────────────────────────────────────────────────────────────

describe("mesParaDate", () => {
  it("retorna o primeiro dia do mês em UTC", () => {
    const d = mesParaDate("2026-07");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(6); // julho = 6
    expect(d.getUTCDate()).toBe(1);
  });
});
