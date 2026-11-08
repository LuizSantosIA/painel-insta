import { describe, it, expect } from "vitest";
import {
  candidatosNaJanela,
  decidirResgate,
  dentroDaJanela,
  horasRestantes,
  JANELA_RESPOSTA_MS,
  type GateParaResgate,
} from "./resgate-gate";

const AGORA = new Date("2026-11-08T15:00:00Z");
const hAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000);

const gate = (over: Partial<GateParaResgate> = {}): GateParaResgate => ({
  id: "g1",
  igsid: "123",
  username: "fulano",
  status: "PENDING",
  ultimaInteracaoEm: hAtras(2),
  ...over,
});

describe("janela de resposta", () => {
  it("usa 23h, não 24 — a folga é de propósito", () => {
    expect(JANELA_RESPOSTA_MS).toBe(23 * 3_600_000);
    expect(dentroDaJanela(hAtras(22), AGORA)).toBe(true);
    expect(dentroDaJanela(hAtras(23.5), AGORA)).toBe(false);
  });

  it("conta as horas que sobram", () => {
    expect(horasRestantes(hAtras(3), AGORA)).toBe(20);
    expect(horasRestantes(hAtras(30), AGORA)).toBeLessThan(0);
  });
});

describe("decidirResgate", () => {
  it("entrega para quem segue e está na janela", () => {
    expect(decidirResgate(gate(), true, AGORA)).toEqual({ resgatar: true });
  });

  it("não entrega fora da janela, mesmo seguindo — é a política da Meta", () => {
    expect(decidirResgate(gate({ ultimaInteracaoEm: hAtras(40) }), true, AGORA)).toEqual({
      resgatar: false,
      motivo: "FORA_DA_JANELA",
    });
  });

  it("não entrega para quem não segue", () => {
    expect(decidirResgate(gate(), false, AGORA)).toEqual({ resgatar: false, motivo: "NAO_SEGUE" });
  });

  it("na dúvida não entrega — null é recusa da Meta, não permissão", () => {
    expect(decidirResgate(gate(), null, AGORA)).toEqual({ resgatar: false, motivo: "SEGUE_DESCONHECIDO" });
  });

  it("não reenvia para quem já recebeu", () => {
    expect(decidirResgate(gate({ status: "DELIVERED" }), true, AGORA)).toEqual({
      resgatar: false,
      motivo: "JA_ENTREGUE",
    });
  });

  it("a janela é checada antes do follow: não gasta consulta com quem já perdeu o prazo", () => {
    const fora = gate({ ultimaInteracaoEm: hAtras(40) });
    expect(decidirResgate(fora, null, AGORA).resgatar).toBe(false);
    expect((decidirResgate(fora, null, AGORA) as { motivo: string }).motivo).toBe("FORA_DA_JANELA");
  });
});

describe("candidatosNaJanela", () => {
  it("filtra a janela e põe o mais recente primeiro", () => {
    const lista = [
      gate({ id: "velho", ultimaInteracaoEm: hAtras(30) }),
      gate({ id: "recente", ultimaInteracaoEm: hAtras(1) }),
      gate({ id: "medio", ultimaInteracaoEm: hAtras(10) }),
      gate({ id: "entregue", status: "DELIVERED", ultimaInteracaoEm: hAtras(1) }),
    ];
    expect(candidatosNaJanela(lista, AGORA).map((g) => g.id)).toEqual(["recente", "medio"]);
  });

  it("lista vazia não quebra", () => {
    expect(candidatosNaJanela([], AGORA)).toEqual([]);
  });
});
