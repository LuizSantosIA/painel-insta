import { describe, it, expect } from "vitest";
import { calcSaude } from "./saude";

const mesAtual = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
const mesPassado = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1));

function diasAtras(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe("calcSaude", () => {
  it("VERMELHO: receita inadimplente", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: new Date(),
      receitas: [{ status: "INADIMPLENTE", competencia: mesAtual }],
    })).toBe("VERMELHO");
  });

  it("VERMELHO: sem contato há 70 dias", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: diasAtras(70),
      receitas: [{ status: "RECEBIDA", competencia: mesAtual }],
    })).toBe("VERMELHO");
  });

  it("VERMELHO: inadimplente mesmo com contato recente", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: diasAtras(5),
      receitas: [{ status: "INADIMPLENTE", competencia: mesAtual }],
    })).toBe("VERMELHO");
  });

  it("AMARELO: receita PREVISTA com competência vencida", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: new Date(),
      receitas: [{ status: "PREVISTA", competencia: mesPassado }],
    })).toBe("AMARELO");
  });

  it("AMARELO: sem contato há 45 dias", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: diasAtras(45),
      receitas: [{ status: "RECEBIDA", competencia: mesAtual }],
    })).toBe("AMARELO");
  });

  it("AMARELO: cliente active sem receitas", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: null,
      receitas: [],
    })).toBe("AMARELO");
  });

  it("VERDE: lead sem receitas não é AMARELO", () => {
    expect(calcSaude({
      status: "lead",
      ultimoContatoEm: null,
      receitas: [],
    })).toBe("VERDE");
  });

  it("VERDE: tudo em ordem", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: diasAtras(5),
      receitas: [{ status: "RECEBIDA", competencia: mesAtual }],
    })).toBe("VERDE");
  });

  it("VERDE: contato há 29 dias não dispara AMARELO", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: diasAtras(29),
      receitas: [{ status: "CONFIRMADA", competencia: mesAtual }],
    })).toBe("VERDE");
  });

  it("VERDE: sem contato registrado e RECEBIDA não penaliza", () => {
    expect(calcSaude({
      status: "active",
      ultimoContatoEm: null,
      receitas: [{ status: "RECEBIDA", competencia: mesAtual }],
    })).toBe("VERDE");
  });
});
