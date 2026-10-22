import { describe, it, expect } from "vitest";
import { avaliarLoop, palavrasQueRetornam } from "./automacao-loop";
import { ehDaPropriaConta } from "./instagram-token";

describe("regra que responde a si mesma", () => {
  it("pega o caso real de 22/10: EDIÇÃO na resposta", () => {
    const a = avaliarLoop({
      keywords: "EDIÇÃO",
      replyText: "Mandei o passo a passo do seu estúdio de edição com IA no direct!!!! 🎥",
    });
    expect(a.risco).toBe(true);
    expect(a.palavras).toEqual(["EDIÇÃO"]);
    expect(a.mensagem).toContain("palavra-chave desta regra");
  });

  it("ignora acento e caixa — foi assim que passou batido", () => {
    expect(palavrasQueRetornam("EDIÇÃO", "estúdio de edicao")).toEqual(["EDIÇÃO"]);
    expect(palavrasQueRetornam("prompt", "O PROMPT está no direct")).toEqual(["prompt"]);
  });

  it("fica quieto quando a resposta não repete a palavra", () => {
    const a = avaliarLoop({ keywords: "EDIÇÃO", replyText: "Te mandei no direct!" });
    expect(a.risco).toBe(false);
    expect(a.mensagem).toBe("");
  });

  it("sem resposta pública não há ciclo — o DM não vira comentário", () => {
    expect(avaliarLoop({ keywords: "EDIÇÃO", replyText: "" }).risco).toBe(false);
    expect(avaliarLoop({ keywords: "EDIÇÃO", replyText: "   " }).risco).toBe(false);
  });

  it("aponta todas as palavras que voltam", () => {
    const a = avaliarLoop({ keywords: "GUIA, PROMPT, xyz", replyText: "O guia e o prompt estão no direct" });
    expect(a.palavras).toEqual(["GUIA", "PROMPT"]);
    expect(a.mensagem).toContain("são palavras-chave");
  });

  it("não se perde com palavra-chave vazia", () => {
    expect(palavrasQueRetornam(" , ,", "qualquer coisa")).toEqual([]);
  });
});

describe("reconhecer a própria conta", () => {
  // A mesma conta aparece com dois ids: o do Instagram Login e o IG User ID
  // clássico, que é o que chega no webhook.
  const identidade = {
    ids: new Set(["27811786615113776", "17841466338389046"]),
    username: "luizsantos.ia",
  };

  it("reconhece pelo id que vem no webhook", () => {
    expect(ehDaPropriaConta(identidade, { id: "17841466338389046" })).toBe(true);
  });

  it("reconhece também pelo id das chamadas", () => {
    expect(ehDaPropriaConta(identidade, { id: "27811786615113776" })).toBe(true);
  });

  it("reconhece pelo @ quando o id não vem", () => {
    expect(ehDaPropriaConta(identidade, { username: "luizsantos.ia" })).toBe(true);
    expect(ehDaPropriaConta(identidade, { username: "@LuizSantos.IA" })).toBe(true);
  });

  it("deixa passar quem é de fora", () => {
    expect(ehDaPropriaConta(identidade, { id: "1147010881355776", username: "amandagomsll" })).toBe(false);
  });

  it("campo vazio não conta como a própria conta", () => {
    expect(ehDaPropriaConta(identidade, {})).toBe(false);
    expect(ehDaPropriaConta(identidade, { id: "", username: "" })).toBe(false);
    expect(ehDaPropriaConta({ ids: new Set(), username: "" }, { id: "", username: "" })).toBe(false);
  });
});
