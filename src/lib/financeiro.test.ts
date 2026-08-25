import { describe, it, expect } from "vitest";
import {
  calcAReceber,
  calcAVencer,
  calcEvolucao,
  calcMRR,
  calcMRRPorLinha,
  calcPorLinha,
  calcProjecao30Dias,
  calcRecebido,
  calcRecebidoPontual,
  calcReceitaPontual,
  calcResumoFinanceiro,
  calcRunway,
  calcTopClientes,
  calcVariacao,
  calcVencido,
  contaParaMRR,
  dateParaMes,
  diasEmAtraso,
  fmtDataInput,
  isVencida,
  mesParaDate,
  parseBRL,
  parseDataUTC,
  recorrentesPendentes,
  statusEfetivo,
  temHistoricoSuficiente,
  ultimoDiaDoMes,
  ultimosMeses,
  vencimentoEfetivo,
  type ReceitaLike,
} from "./financeiro";

// Data fixa: nenhum teste pode depender do dia em que roda.
const HOJE = new Date("2026-08-20T12:00:00.000Z");

function receita(over: Partial<ReceitaLike> = {}): ReceitaLike {
  return {
    tipo: "RECORRENTE",
    status: "CONFIRMADA",
    valorCentavos: 150_000,
    linha: "SERVICOS",
    competencia: new Date(Date.UTC(2026, 7, 1)),
    vencimento: new Date(Date.UTC(2026, 7, 25)),
    dataRecebida: null,
    ...over,
  };
}

// ─── Vencimento e status derivado ────────────────────────────────────────────

describe("vencimentoEfetivo", () => {
  it("usa a data informada quando existe", () => {
    const v = vencimentoEfetivo(receita({ vencimento: new Date(Date.UTC(2026, 7, 10)) }));
    expect(fmtDataInput(v!)).toBe("2026-08-10");
  });

  it("cai no último dia da competência quando não há vencimento", () => {
    // Preserva o comportamento das receitas anteriores à migração.
    const v = vencimentoEfetivo(receita({ vencimento: null }));
    expect(fmtDataInput(v!)).toBe("2026-08-31");
  });

  it("acerta o último dia em fevereiro bissexto", () => {
    const v = ultimoDiaDoMes(new Date(Date.UTC(2028, 1, 1)));
    expect(fmtDataInput(v)).toBe("2028-02-29");
  });
});

describe("statusEfetivo", () => {
  it("recebida vence tudo", () => {
    const r = receita({ status: "RECEBIDA", vencimento: new Date(Date.UTC(2026, 0, 1)) });
    expect(statusEfetivo(r, HOJE)).toBe("RECEBIDA");
    expect(isVencida(r, HOJE)).toBe(false);
  });

  it("cancelada nunca vence nem entra em soma", () => {
    const r = receita({ status: "CANCELADA", vencimento: new Date(Date.UTC(2026, 0, 1)) });
    expect(statusEfetivo(r, HOJE)).toBe("CANCELADA");
    expect(isVencida(r, HOJE)).toBe(false);
    expect(calcAReceber([r])).toBe(0);
    expect(calcMRR([r], HOJE)).toBe(0);
  });

  it("deriva VENCIDA de vencimento passado sem depender de marcação manual", () => {
    const r = receita({ status: "CONFIRMADA", vencimento: new Date(Date.UTC(2026, 7, 14)) });
    expect(statusEfetivo(r, HOJE)).toBe("VENCIDA");
    expect(diasEmAtraso(r, HOJE)).toBe(6);
  });

  it("não considera vencida no próprio dia do vencimento", () => {
    const r = receita({ vencimento: new Date(Date.UTC(2026, 7, 20)) });
    expect(isVencida(r, HOJE)).toBe(false);
    expect(statusEfetivo(r, HOJE)).toBe("A_RECEBER");
  });

  it("mantém o legado INADIMPLENTE como vencida", () => {
    const r = receita({ status: "INADIMPLENTE", vencimento: new Date(Date.UTC(2026, 11, 1)) });
    expect(statusEfetivo(r, HOJE)).toBe("VENCIDA");
  });

  it("PREVISTA em dia é prevista, não a receber", () => {
    expect(statusEfetivo(receita({ status: "PREVISTA" }), HOJE)).toBe("PREVISTA");
  });
});

// ─── Timezone ────────────────────────────────────────────────────────────────

describe("datas em UTC", () => {
  it("parseDataUTC não desloca o dia a oeste de Greenwich", () => {
    const d = parseDataUTC("2026-08-20");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(20);
    expect(fmtDataInput(d)).toBe("2026-08-20");
  });

  it("competência é sempre o dia 1 em UTC", () => {
    const d = mesParaDate("2026-07");
    expect(d.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(dateParaMes(d)).toBe("2026-07");
  });

  it("uma receita que vence hoje não nasce vencida", () => {
    // O caso que quebra em fuso negativo se a comparação não for por dia UTC.
    const r = receita({ vencimento: parseDataUTC("2026-08-20") });
    expect(isVencida(r, new Date("2026-08-20T23:59:00.000Z"))).toBe(false);
  });

  it("ultimosMeses respeita o mês de referência e não o relógio", () => {
    expect(ultimosMeses(3, HOJE)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("ultimosMeses atravessa a virada de ano", () => {
    expect(ultimosMeses(3, new Date("2026-01-15T00:00:00Z"))).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
  });
});

// ─── MRR ─────────────────────────────────────────────────────────────────────

describe("calcMRR", () => {
  it("soma só recorrente contratada e em dia", () => {
    const rs = [
      receita({ valorCentavos: 100_000, status: "CONFIRMADA" }),
      receita({ valorCentavos: 200_000, status: "RECEBIDA" }),
      receita({ valorCentavos: 50_000, status: "PREVISTA" }), // ainda não é acordo firme
      receita({ valorCentavos: 30_000, status: "CANCELADA" }),
      receita({ valorCentavos: 999_900, tipo: "PONTUAL", status: "RECEBIDA" }),
    ];
    expect(calcMRR(rs, HOJE)).toBe(300_000);
  });

  it("receita vencida não infla o MRR", () => {
    const emDia = receita({ valorCentavos: 100_000 });
    const atrasada = receita({ valorCentavos: 90_000, vencimento: new Date(Date.UTC(2026, 7, 1)) });
    expect(calcMRR([emDia, atrasada], HOJE)).toBe(100_000);
    expect(contaParaMRR(atrasada, HOJE)).toBe(false);
  });

  it("oportunidade aberta não existe aqui — MRR só lê receita registrada", () => {
    expect(calcMRR([], HOJE)).toBe(0);
  });

  it("pontual não contamina o MRR", () => {
    const rs = [
      receita({ valorCentavos: 100_000 }),
      receita({ tipo: "PONTUAL", status: "RECEBIDA", valorCentavos: 500_000 }),
    ];
    expect(calcMRR(rs, HOJE)).toBe(100_000);
    expect(calcReceitaPontual(rs)).toBe(500_000);
  });

  it("segrega por linha", () => {
    const rs = [
      receita({ linha: "INNOBI", valorCentavos: 100_000 }),
      receita({ linha: "MENTORIA", valorCentavos: 50_000 }),
      receita({ linha: "SERVICOS", valorCentavos: 80_000 }),
      receita({ linha: "INNOBI", tipo: "PONTUAL", status: "RECEBIDA", valorCentavos: 999_000 }),
    ];
    const r = calcMRRPorLinha(rs, HOJE);
    expect(r).toEqual({ INNOBI: 100_000, MENTORIA: 50_000, SERVICOS: 80_000 });
  });
});

// ─── Recebido, a receber, vencido ────────────────────────────────────────────

describe("recebido e a receber", () => {
  const rs = [
    receita({ status: "RECEBIDA", valorCentavos: 100_000 }),
    receita({ status: "RECEBIDA", tipo: "PONTUAL", valorCentavos: 45_000 }),
    receita({ status: "CONFIRMADA", valorCentavos: 60_000 }),
    receita({ status: "PREVISTA", valorCentavos: 20_000 }),
    receita({ status: "CANCELADA", valorCentavos: 900_000 }),
  ];

  it("recebido é só o que entrou de fato", () => {
    expect(calcRecebido(rs)).toBe(145_000);
    expect(calcRecebidoPontual(rs)).toBe(45_000);
  });

  it("a receber é tudo que não entrou e não foi cancelado", () => {
    expect(calcAReceber(rs)).toBe(80_000);
  });

  it("vencido é a fatia atrasada do a receber", () => {
    const comAtraso = [
      receita({ status: "CONFIRMADA", valorCentavos: 30_000, vencimento: new Date(Date.UTC(2026, 7, 5)) }),
      receita({ status: "CONFIRMADA", valorCentavos: 70_000, vencimento: new Date(Date.UTC(2026, 8, 5)) }),
    ];
    expect(calcVencido(comAtraso, HOJE)).toBe(30_000);
    expect(calcAReceber(comAtraso)).toBe(100_000);
  });

  it("a vencer olha para frente e ignora o que já venceu", () => {
    const rs2 = [
      receita({ valorCentavos: 10_000, vencimento: new Date(Date.UTC(2026, 7, 22)) }), // em 2 dias
      receita({ valorCentavos: 20_000, vencimento: new Date(Date.UTC(2026, 8, 15)) }), // em 26 dias
      receita({ valorCentavos: 40_000, vencimento: new Date(Date.UTC(2026, 7, 1)) }), // vencida
    ];
    expect(calcAVencer(rs2, 7, HOJE)).toBe(10_000);
    expect(calcProjecao30Dias(rs2, HOJE)).toBe(30_000);
  });
});

// ─── Runway ──────────────────────────────────────────────────────────────────

describe("calcRunway", () => {
  it("sem despesas não inventa runway", () => {
    const r = calcRunway(1_000_000, [{ totalCentavos: 0 }, { totalCentavos: 0 }, { totalCentavos: 0 }]);
    expect(r.meses).toBeNull();
    expect(r.motivo).toBe("SEM_DESPESAS");
  });

  it("sem saldo informado também não", () => {
    const r = calcRunway(0, [{ totalCentavos: 100_000 }]);
    expect(r.meses).toBeNull();
    expect(r.motivo).toBe("SEM_SALDO");
  });

  it("calcula com saldo e burn, arredondando para baixo", () => {
    const r = calcRunway(250_000, [
      { totalCentavos: 100_000 },
      { totalCentavos: 100_000 },
      { totalCentavos: 100_000 },
    ]);
    expect(r.meses).toBe(2); // 2,5 → 2
    expect(r.burnMedioCentavos).toBe(100_000);
    expect(r.motivo).toBe("OK");
  });
});

// ─── Variação ────────────────────────────────────────────────────────────────

describe("calcVariacao", () => {
  it("calcula a variação percentual", () => {
    expect(calcVariacao(110_000, 100_000)).toBeCloseTo(10);
    expect(calcVariacao(90_000, 100_000)).toBeCloseTo(-10);
  });

  it("sem mês anterior não mostra comparação enganosa", () => {
    expect(calcVariacao(50_000, 0)).toBeNull();
  });
});

// ─── Resumo do mês ───────────────────────────────────────────────────────────

describe("calcResumoFinanceiro", () => {
  it("junta tudo com a mesma régua e não perde o vencido de meses antigos", () => {
    const doMes = [
      receita({ status: "RECEBIDA", valorCentavos: 100_000 }),
      receita({ status: "CONFIRMADA", valorCentavos: 150_000 }),
      receita({ status: "RECEBIDA", tipo: "PONTUAL", valorCentavos: 45_000 }),
    ];
    // Uma cobrança de junho, ainda aberta: tem de aparecer mesmo vendo agosto.
    const emAberto = [
      ...doMes.filter((r) => r.status !== "RECEBIDA"),
      receita({
        status: "CONFIRMADA",
        valorCentavos: 80_000,
        competencia: new Date(Date.UTC(2026, 5, 1)),
        vencimento: new Date(Date.UTC(2026, 5, 30)),
      }),
    ];

    const resumo = calcResumoFinanceiro({
      receitasMes: doMes,
      receitasMesAnterior: [receita({ status: "CONFIRMADA", valorCentavos: 100_000 })],
      receitasEmAberto: emAberto,
      saldoCentavos: 600_000,
      despesasPorMes: [{ totalCentavos: 200_000 }, { totalCentavos: 200_000 }, { totalCentavos: 200_000 }],
      despesasMesCentavos: 200_000,
      agora: HOJE,
    });

    expect(resumo.mrrAtual).toBe(250_000);
    expect(resumo.mrrVariacao).toBeCloseTo(150);
    expect(resumo.recebido).toBe(145_000);
    expect(resumo.recebidoPontual).toBe(45_000);
    expect(resumo.aReceber).toBe(230_000);
    expect(resumo.vencido).toBe(80_000);
    expect(resumo.runway).toBe(3);
  });
});

// ─── Por linha e top clientes ────────────────────────────────────────────────

describe("calcPorLinha", () => {
  it("distribui o mês e fecha em 100%", () => {
    const rs = [
      receita({ linha: "SERVICOS", valorCentavos: 120_000 }),
      receita({ linha: "MENTORIA", valorCentavos: 70_000 }),
      receita({ linha: "INNOBI", valorCentavos: 10_000 }),
    ];
    const linhas = calcPorLinha(rs, HOJE);
    expect(linhas[0].linha).toBe("SERVICOS"); // ordenado por valor
    expect(linhas.reduce((s, l) => s + l.percentual, 0)).toBe(100);
  });

  it("cancelada não entra na distribuição", () => {
    const linhas = calcPorLinha([receita({ status: "CANCELADA", valorCentavos: 500_000 })], HOJE);
    expect(linhas.every((l) => l.totalCentavos === 0)).toBe(true);
  });
});

describe("calcTopClientes", () => {
  it("agrupa por cliente e ignora receita sem vínculo", () => {
    const rs = [
      { ...receita({ valorCentavos: 300_000 }), clienteId: "c1", clienteNome: "Mantegaria" },
      { ...receita({ valorCentavos: 150_000, status: "RECEBIDA" }), clienteId: "c1", clienteNome: "Mantegaria" },
      { ...receita({ valorCentavos: 200_000 }), clienteId: "c2", clienteNome: "Empresa X" },
      { ...receita({ valorCentavos: 999_000 }), clienteId: null, clienteNome: null },
    ];
    const top = calcTopClientes(rs, 5, HOJE);
    expect(top).toHaveLength(2);
    expect(top[0].nome).toBe("Mantegaria");
    expect(top[0].totalCentavos).toBe(450_000);
    expect(top[0].recebidoCentavos).toBe(150_000);
  });
});

// ─── Evolução ────────────────────────────────────────────────────────────────

describe("evolução", () => {
  it("não desenha gráfico com menos de dois meses com movimento", () => {
    const serie = calcEvolucao(
      [
        { mes: "2026-07", receitas: [] },
        { mes: "2026-08", receitas: [receita({ valorCentavos: 100_000 })] },
      ],
      HOJE
    );
    expect(temHistoricoSuficiente(serie)).toBe(false);
  });

  it("desenha a partir de dois meses com movimento", () => {
    const serie = calcEvolucao(
      [
        { mes: "2026-07", receitas: [receita({ valorCentavos: 80_000 })] },
        { mes: "2026-08", receitas: [receita({ tipo: "PONTUAL", valorCentavos: 100_000 })] },
      ],
      HOJE
    );
    expect(temHistoricoSuficiente(serie)).toBe(true);
    expect(serie[0].label).toBe("jul");
    expect(serie[1].pontual).toBe(100_000);
    expect(serie[1].recorrente).toBe(0);
  });
});

// ─── Recorrência ─────────────────────────────────────────────────────────────

describe("recorrentesPendentes", () => {
  const julho = [
    { ...receita({ valorCentavos: 150_000 }), id: "a", contratoId: "a" },
    { ...receita({ valorCentavos: 90_000 }), id: "b", contratoId: "b" },
  ];

  it("aponta o que falta lançar no mês seguinte", () => {
    expect(recorrentesPendentes(julho, []).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("não replica o contrato que já tem competência no destino", () => {
    const agosto = [{ ...receita({ valorCentavos: 150_000 }), id: "a2", contratoId: "a" }];
    expect(recorrentesPendentes(julho, agosto).map((r) => r.id)).toEqual(["b"]);
  });

  it("rodar duas vezes não duplica — é a trava de idempotência", () => {
    const agosto = julho.map((r, i) => ({ ...r, id: `novo${i}`, contratoId: r.contratoId }));
    expect(recorrentesPendentes(julho, agosto)).toHaveLength(0);
  });

  it("recorrência cancelada não é replicada", () => {
    const cancelada = [{ ...receita({ status: "CANCELADA" }), id: "z", contratoId: "z" }];
    expect(recorrentesPendentes(cancelada, [])).toHaveLength(0);
  });

  it("pontual nunca é replicada", () => {
    const pontual = [{ ...receita({ tipo: "PONTUAL" }), id: "p", contratoId: null }];
    expect(recorrentesPendentes(pontual, [])).toHaveLength(0);
  });

  it("receita antiga sem contratoId usa o próprio id como contrato", () => {
    const legado = [{ ...receita(), id: "velha", contratoId: null }];
    const destino = [{ ...receita(), id: "copia", contratoId: "velha" }];
    expect(recorrentesPendentes(legado, destino)).toHaveLength(0);
  });
});

// ─── Dinheiro ────────────────────────────────────────────────────────────────

describe("parseBRL", () => {
  it("converte entrada do usuário para centavos inteiros", () => {
    expect(parseBRL("1997")).toBe(199_700);
    expect(parseBRL("1997.50")).toBe(199_750);
    expect(parseBRL("1997,50")).toBe(199_750);
    expect(parseBRL("R$ 1.997,00")).toBe(199_700);
    expect(parseBRL("")).toBe(0);
  });

  it("não devolve NaN para lixo digitado", () => {
    expect(parseBRL("abc")).toBe(0);
  });

  it("arredonda centavos sem erro de ponto flutuante", () => {
    expect(parseBRL("0,07")).toBe(7);
    expect(parseBRL("1234,56")).toBe(123_456);
    expect(Number.isInteger(parseBRL("19,99"))).toBe(true);
  });
});
