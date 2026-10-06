import { describe, it, expect } from "vitest";
import { diasAte, expirado, precisaAlertar, precisaRenovar, DIAS_TOKEN, DIAS_PARA_RENOVAR, DIAS_PARA_ALERTAR } from "./instagram-token";
import { montarAlertasMaquina } from "./maquina";

const emDias = (n: number, base = new Date("2026-10-06T12:00:00Z")) =>
  new Date(base.getTime() + n * 86_400_000);

describe("validade do token do Instagram", () => {
  const agora = new Date("2026-10-06T12:00:00Z");

  it("conta os dias que faltam", () => {
    expect(diasAte(emDias(30), agora)).toBe(30);
    expect(diasAte(emDias(0.5), agora)).toBe(0);
    expect(diasAte(null, agora)).toBeNull();
  });

  it("dá negativo para token vencido — foi o que passou despercebido em outubro", () => {
    expect(diasAte(emDias(-3), agora)).toBe(-3);
  });

  it("a janela de renovação abre antes de a de alerta", () => {
    expect(DIAS_PARA_RENOVAR).toBeLessThan(DIAS_TOKEN);
    expect(DIAS_PARA_ALERTAR).toBeLessThan(DIAS_TOKEN - DIAS_PARA_RENOVAR);
  });
});

describe("alerta de token no Hoje", () => {
  const base = {
    aguardandoResposta: 0,
    leadsNaoTratados: [],
    agendadosVencidos: [],
    diasSemPublicar: 1,
    diasSemSincronizar: 1,
    instagramConectado: true,
    automacoesSemExecucao: 0,
  };
  const doToken = (d: Partial<typeof base> & { diasAteTokenExpirar?: number | null }) =>
    montarAlertasMaquina({ ...base, ...d }).find((a) => a.id === "token-instagram");

  it("fica calado enquanto falta tempo", () => {
    expect(doToken({ diasAteTokenExpirar: 45 })).toBeUndefined();
    expect(doToken({ diasAteTokenExpirar: 8 })).toBeUndefined();
  });

  it("avisa a partir de 7 dias, sem gritar", () => {
    const a = doToken({ diasAteTokenExpirar: 7 });
    expect(a?.severidade).toBe("ATENCAO");
    expect(a?.titulo).toContain("7 dias");
    expect(a?.destino).toBe("/maquina/integracoes");
  });

  it("concorda no singular", () => {
    expect(doToken({ diasAteTokenExpirar: 1 })?.titulo).toContain("1 dia");
  });

  it("vira urgente quando expira", () => {
    const a = doToken({ diasAteTokenExpirar: 0 });
    expect(a?.severidade).toBe("URGENTE");
    expect(a?.titulo).toContain("expirou");
    const vencido = doToken({ diasAteTokenExpirar: -3 });
    expect(vencido?.severidade).toBe("URGENTE");
  });

  it("não fala de validade quando a data é desconhecida", () => {
    expect(doToken({ diasAteTokenExpirar: null })).toBeUndefined();
    expect(doToken({})).toBeUndefined();
  });

  it("desconectado é outro alerta — não duplica com o de validade", () => {
    const alertas = montarAlertasMaquina({ ...base, instagramConectado: false, diasAteTokenExpirar: -3 });
    expect(alertas.find((a) => a.id === "integracao-instagram")).toBeDefined();
    expect(alertas.find((a) => a.id === "token-instagram")).toBeUndefined();
  });
});

describe("token recusado pela Graph API", () => {
  const base = {
    aguardandoResposta: 0,
    leadsNaoTratados: [],
    agendadosVencidos: [],
    diasSemPublicar: 1,
    diasSemSincronizar: 1,
    instagramConectado: true,
    automacoesSemExecucao: 0,
  };

  it("vira urgente mesmo sem data de validade — o caso que passou batido", () => {
    const a = montarAlertasMaquina({ ...base, diasAteTokenExpirar: null, tokenRecusado: true }).find(
      (x) => x.id === "token-instagram"
    );
    expect(a?.severidade).toBe("URGENTE");
    expect(a?.titulo).toContain("expirou");
  });

  it("sem recusa e sem data, continua calado", () => {
    const alertas = montarAlertasMaquina({ ...base, diasAteTokenExpirar: null, tokenRecusado: false });
    expect(alertas.find((x) => x.id === "token-instagram")).toBeUndefined();
  });

  it("a recusa manda mais que uma validade folgada", () => {
    const a = montarAlertasMaquina({ ...base, diasAteTokenExpirar: 40, tokenRecusado: true }).find(
      (x) => x.id === "token-instagram"
    );
    expect(a?.severidade).toBe("URGENTE");
  });
});
