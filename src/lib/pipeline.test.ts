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
