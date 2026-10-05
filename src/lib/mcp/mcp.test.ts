import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { dinheiro, lista, plural, quando, resumir, secoes } from "./formato";
import { autorizar, extrairToken, tokenConfigurado } from "./token";

describe("formato", () => {
  it("escreve dinheiro em reais a partir de centavos", () => {
    expect(dinheiro(123456)).toContain("1.234,56");
    expect(dinheiro(0)).toContain("0,00");
  });

  it("diz quando em dias, com hoje e ontem por extenso", () => {
    const agora = new Date("2026-03-10T12:00:00Z");
    expect(quando(new Date("2026-03-10T18:00:00Z"), agora)).toBe("hoje");
    expect(quando(new Date("2026-03-11T12:00:00Z"), agora)).toBe("amanhã");
    expect(quando(new Date("2026-03-09T12:00:00Z"), agora)).toBe("ontem");
    expect(quando(new Date("2026-03-15T12:00:00Z"), agora)).toBe("em 5 dias");
    expect(quando(new Date("2026-03-01T12:00:00Z"), agora)).toBe("há 9 dias");
    expect(quando(null, agora)).toBe("sem data");
  });

  it("resume sem partir palavra e sem mexer no que já cabe", () => {
    expect(resumir("curto", 20)).toBe("curto");
    const r = resumir("palavra ".repeat(20), 30);
    expect(r.endsWith("…")).toBe(true);
    expect(r.length).toBeLessThanOrEqual(31);
    expect(r).not.toContain("palav…");
  });

  it("lista cai no texto de vazio quando não há item", () => {
    expect(lista([], "Nada.")).toBe("Nada.");
    expect(lista(["a", "b"], "Nada.")).toBe("- a\n- b");
  });

  it("secoes descarta parte vazia, nula ou falsa", () => {
    expect(secoes("a", "", null, undefined, false, "b")).toBe("a\n\nb");
  });

  it("plural concorda", () => {
    expect(plural(1, "dia")).toBe("1 dia");
    expect(plural(3, "dia")).toBe("3 dias");
    expect(plural(2, "post", "posts")).toBe("2 posts");
  });
});

describe("token do MCP", () => {
  const original = process.env.MCP_API_TOKEN;
  const valido = "x".repeat(32);

  beforeEach(() => {
    process.env.MCP_API_TOKEN = valido;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.MCP_API_TOKEN;
    else process.env.MCP_API_TOKEN = original;
  });

  const com = (h: Record<string, string>) => new Headers(h);

  it("aceita Bearer e x-mcp-token", () => {
    expect(autorizar(com({ authorization: `Bearer ${valido}` }))).toEqual({ ok: true });
    expect(autorizar(com({ "x-mcp-token": valido }))).toEqual({ ok: true });
  });

  it("recusa token errado, token de outro tamanho e ausência de token", () => {
    expect(autorizar(com({ authorization: `Bearer ${"y".repeat(32)}` }))).toMatchObject({ ok: false, status: 401 });
    expect(autorizar(com({ authorization: "Bearer curto" }))).toMatchObject({ ok: false, status: 401 });
    expect(autorizar(com({}))).toMatchObject({ ok: false, status: 401 });
  });

  it("fica fechado — não aberto — quando não há token configurado", () => {
    delete process.env.MCP_API_TOKEN;
    expect(tokenConfigurado()).toBe(false);
    expect(autorizar(com({ authorization: `Bearer ${valido}` }))).toMatchObject({ ok: false, status: 503 });
  });

  it("recusa token curto demais mesmo que bata", () => {
    process.env.MCP_API_TOKEN = "curto";
    expect(autorizar(com({ authorization: "Bearer curto" }))).toMatchObject({ ok: false, status: 503 });
  });

  it("extrai o token dos dois cabeçalhos e ignora esquema errado", () => {
    expect(extrairToken(com({ authorization: "Bearer abc" }))).toBe("abc");
    expect(extrairToken(com({ authorization: "Basic abc" }))).toBeNull();
    expect(extrairToken(com({ "x-mcp-token": " abc " }))).toBe("abc");
    expect(extrairToken(com({}))).toBeNull();
  });
});
