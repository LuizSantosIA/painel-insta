import { describe, it, expect } from "vitest";
import { diasParaVencer, isVencido, fmtPrazo } from "./compromisso";

function utcDias(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

describe("diasParaVencer", () => {
  it("hoje é 0", () => {
    expect(diasParaVencer(new Date())).toBe(0);
  });

  it("amanhã é 1", () => {
    expect(diasParaVencer(utcDias(1))).toBe(1);
  });

  it("ontem é -1", () => {
    expect(diasParaVencer(utcDias(-1))).toBe(-1);
  });

  it("daqui 7 dias é 7", () => {
    expect(diasParaVencer(utcDias(7))).toBe(7);
  });

  it("30 dias atrás é -30", () => {
    expect(diasParaVencer(utcDias(-30))).toBe(-30);
  });

  it("aceita string ISO", () => {
    const d = utcDias(3);
    expect(diasParaVencer(d.toISOString())).toBe(3);
  });
});

describe("isVencido", () => {
  it("prazo passado + não cumprido → vencido", () => {
    expect(isVencido(utcDias(-1), false)).toBe(true);
  });

  it("prazo passado + cumprido → não vencido", () => {
    expect(isVencido(utcDias(-1), true)).toBe(false);
  });

  it("prazo futuro + não cumprido → não vencido", () => {
    expect(isVencido(utcDias(1), false)).toBe(false);
  });

  it("hoje + não cumprido → não vencido", () => {
    expect(isVencido(new Date(), false)).toBe(false);
  });
});

describe("fmtPrazo", () => {
  it("hoje → 'hoje'", () => {
    expect(fmtPrazo(new Date())).toBe("hoje");
  });

  it("amanhã → 'amanhã'", () => {
    expect(fmtPrazo(utcDias(1))).toBe("amanhã");
  });

  it("ontem → 'ontem'", () => {
    expect(fmtPrazo(utcDias(-1))).toBe("ontem");
  });

  it("5 dias atrás → 'X dias atrás'", () => {
    expect(fmtPrazo(utcDias(-5))).toBe("5 dias atrás");
  });

  it("daqui 10 dias → 'em 10 dias'", () => {
    expect(fmtPrazo(utcDias(10))).toBe("em 10 dias");
  });
});
