import { describe, it, expect } from "vitest";
import {
  ASK_PADRAO,
  DELIVER_PADRAO,
  MAX_TENTATIVAS,
  decidirAcaoGate,
  gateConfigurado,
  normalizar,
  payloadDaRegra,
  rotuloBotao,
  ruleIdDoPayload,
  textoEntrega,
  textoPedido,
  type RegraGate,
} from "./follow-gate-core";

function regra(over: Partial<RegraGate> = {}): RegraGate {
  return {
    id: "rule1",
    exigirSeguir: true,
    linkLiberado: "https://exemplo.com/material",
    gateAskText: "",
    gateButtonLabel: "Seguindo",
    gateDeliverText: "",
    gateLinkLabel: "Acessar",
    ...over,
  };
}

describe("gateConfigurado", () => {
  it("aceita regra com trava ligada e link https", () => {
    expect(gateConfigurado(regra())).toBe(true);
  });

  it("aceita link http", () => {
    expect(gateConfigurado(regra({ linkLiberado: "http://exemplo.com" }))).toBe(true);
  });

  it("recusa quando a trava está desligada", () => {
    expect(gateConfigurado(regra({ exigirSeguir: false }))).toBe(false);
  });

  it("recusa link vazio", () => {
    expect(gateConfigurado(regra({ linkLiberado: "" }))).toBe(false);
  });

  it("recusa link sem protocolo — o botão web_url exigiria URL completa", () => {
    expect(gateConfigurado(regra({ linkLiberado: "exemplo.com/material" }))).toBe(false);
  });

  it("ignora espaços em volta do link", () => {
    expect(gateConfigurado(regra({ linkLiberado: "  https://exemplo.com  " }))).toBe(true);
  });
});

describe("decidirAcaoGate", () => {
  it("entrega quando a pessoa segue", () => {
    expect(decidirAcaoGate(true, 1)).toBe("ENTREGAR");
  });

  it("entrega mesmo depois do limite, se a pessoa passou a seguir", () => {
    expect(decidirAcaoGate(true, MAX_TENTATIVAS + 5)).toBe("ENTREGAR");
  });

  it("repete o pedido quando não segue", () => {
    expect(decidirAcaoGate(false, 1)).toBe("REPETIR");
  });

  it("repete quando não deu para saber — null nunca libera o link", () => {
    expect(decidirAcaoGate(null, 1)).toBe("REPETIR");
  });

  it("desiste ao bater o limite de tentativas", () => {
    expect(decidirAcaoGate(false, MAX_TENTATIVAS)).toBe("DESISTIR");
  });

  it("desiste também quando o follow é desconhecido e o limite estourou", () => {
    expect(decidirAcaoGate(null, MAX_TENTATIVAS + 1)).toBe("DESISTIR");
  });

  it("ainda repete uma tentativa antes do limite", () => {
    expect(decidirAcaoGate(false, MAX_TENTATIVAS - 1)).toBe("REPETIR");
  });
});

describe("payload do botão", () => {
  it("faz o ida e volta do id da regra", () => {
    expect(ruleIdDoPayload(payloadDaRegra("abc123"))).toBe("abc123");
  });

  it("ignora payload de outra automação", () => {
    expect(ruleIdDoPayload("OUTRA_COISA:abc")).toBeNull();
  });

  it("ignora payload com prefixo mas sem id", () => {
    expect(ruleIdDoPayload("FOLLOWGATE:")).toBeNull();
  });
});

describe("textos e rótulos", () => {
  it("usa o texto padrão quando a regra não define um", () => {
    expect(textoPedido(regra())).toBe(ASK_PADRAO);
    expect(textoEntrega(regra())).toBe(DELIVER_PADRAO);
  });

  it("usa o texto da regra quando preenchido", () => {
    expect(textoPedido(regra({ gateAskText: "Me segue aí" }))).toBe("Me segue aí");
  });

  it("trata texto só com espaços como vazio", () => {
    expect(textoPedido(regra({ gateAskText: "   " }))).toBe(ASK_PADRAO);
  });

  it("cai no rótulo padrão do botão quando vazio", () => {
    expect(rotuloBotao(regra({ gateButtonLabel: "" }))).toBe("Seguindo");
  });
});

describe("normalizar", () => {
  it("iguala o que a pessoa digita ao rótulo do botão", () => {
    expect(normalizar(" SEGUINDO ")).toBe(normalizar("Seguindo"));
  });

  it("ignora acentos", () => {
    expect(normalizar("Já Segui")).toBe("ja segui");
  });
});
