import { describe, it, expect } from "vitest";
import {
  calcMetricasCliente,
  fmtDataHumana,
  fmtMesAno,
  fmtPrazoCurto,
  isTipoInteracao,
  montarTimeline,
  proximaAcaoDoCliente,
  ultimoContato,
  type CompromissoCliente,
  type LeadCliente,
  type ReceitaCliente,
  type TarefaCliente,
} from "./cliente-360";

/** Data a N dias de hoje, ao meio-dia UTC para não escorregar de dia por fuso. */
function dia(offset: number): Date {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate() + offset, 12));
}

/** Primeiro dia do mês N meses atrás — formato de competência das receitas. */
function competencia(mesesAtras: number): string {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - mesesAtras, 1)).toISOString();
}

function receita(over: Partial<ReceitaCliente> = {}): ReceitaCliente {
  return {
    id: "r1",
    descricao: "Mensalidade",
    valorCentavos: 250000,
    linha: "INNOBI",
    tipo: "RECORRENTE",
    status: "RECEBIDA",
    competencia: competencia(0),
    vencimento: null,
    dataRecebida: null,
    criadoEm: dia(-10).toISOString(),
    ...over,
  };
}

function tarefa(over: Partial<TarefaCliente> = {}): TarefaCliente {
  return {
    id: "t1",
    title: "Enviar proposta",
    dueDate: dia(2).toISOString(),
    done: false,
    concluidaEm: null,
    createdAt: dia(-5).toISOString(),
    ...over,
  };
}

function compromisso(over: Partial<CompromissoCliente> = {}): CompromissoCliente {
  return {
    id: "c1",
    descricao: "Reunião de alinhamento",
    prazoEm: dia(5).toISOString(),
    cumprido: false,
    cumpridoEm: null,
    criadoEm: dia(-3).toISOString(),
    ...over,
  };
}

function lead(over: Partial<LeadCliente> = {}): LeadCliente {
  return {
    id: "l1",
    nome: "Projeto novo",
    estagio: "PROPOSTA_ENVIADA",
    valorEstimadoCentavos: 500000,
    proximaAcao: "Follow-up",
    proximaAcaoEm: dia(3).toISOString(),
    criadoEm: dia(-7).toISOString(),
    atualizadoEm: dia(-1).toISOString(),
    ...over,
  };
}

describe("fmtDataHumana", () => {
  it("nomeia hoje e ontem", () => {
    expect(fmtDataHumana(dia(0))).toBe("Hoje");
    expect(fmtDataHumana(dia(-1))).toBe("Ontem");
  });

  it("conta os dias na primeira semana", () => {
    expect(fmtDataHumana(dia(-4))).toBe("há 4 dias");
  });

  it("vira data curta a partir de uma semana", () => {
    expect(fmtDataHumana(dia(-30))).toMatch(/^\d{1,2} \w{3}$/);
  });

  it("devolve traço sem data", () => {
    expect(fmtDataHumana(null)).toBe("—");
  });
});

describe("fmtPrazoCurto", () => {
  it("nomeia hoje e amanhã", () => {
    expect(fmtPrazoCurto(dia(0))).toBe("hoje");
    expect(fmtPrazoCurto(dia(1))).toBe("amanhã");
  });

  it("conta os dias que faltam", () => {
    expect(fmtPrazoCurto(dia(3))).toBe("em 3 dias");
  });

  it("marca o atraso", () => {
    expect(fmtPrazoCurto(dia(-2))).toBe("atrasado 2d");
  });
});

describe("fmtMesAno", () => {
  it("formata com mês capitalizado", () => {
    expect(fmtMesAno("2026-03-15T00:00:00.000Z")).toBe("Mar 2026");
  });
});

describe("calcMetricasCliente", () => {
  const base = { criadoEm: "2026-03-01T00:00:00.000Z", agora: new Date() };

  it("conta como MRR só recorrente confirmada/recebida do mês corrente", () => {
    const m = calcMetricasCliente({
      ...base,
      receitas: [
        receita({ id: "a", tipo: "RECORRENTE", status: "RECEBIDA", valorCentavos: 250000 }),
        receita({ id: "b", tipo: "PONTUAL", status: "RECEBIDA", valorCentavos: 900000 }),
        receita({ id: "c", tipo: "RECORRENTE", status: "PREVISTA", valorCentavos: 100000 }),
        receita({ id: "d", tipo: "RECORRENTE", status: "RECEBIDA", competencia: competencia(2), valorCentavos: 700000 }),
      ],
      leads: [],
      tarefas: [],
    });
    expect(m.mrrCentavos).toBe(250000);
  });

  it("soma na receita total só o que foi recebido, de qualquer competência", () => {
    const m = calcMetricasCliente({
      ...base,
      receitas: [
        receita({ id: "a", status: "RECEBIDA", valorCentavos: 250000 }),
        receita({ id: "b", status: "RECEBIDA", competencia: competencia(3), valorCentavos: 400000 }),
        receita({ id: "c", status: "CONFIRMADA", valorCentavos: 999999 }),
      ],
      leads: [],
      tarefas: [],
    });
    expect(m.receitaTotalCentavos).toBe(650000);
    expect(m.aReceberCentavos).toBe(999999);
  });

  it("conta só oportunidades em estágio aberto", () => {
    const m = calcMetricasCliente({
      ...base,
      receitas: [],
      leads: [
        lead({ id: "1", estagio: "LEAD" }),
        lead({ id: "2", estagio: "NEGOCIACAO" }),
        lead({ id: "3", estagio: "FECHADO" }),
        lead({ id: "4", estagio: "PERDIDO" }),
      ],
      tarefas: [],
    });
    expect(m.oportunidadesAbertas).toBe(2);
  });

  it("conta só tarefas em aberto", () => {
    const m = calcMetricasCliente({
      ...base,
      receitas: [],
      leads: [],
      tarefas: [tarefa({ id: "1" }), tarefa({ id: "2", done: true })],
    });
    expect(m.tarefasAbertas).toBe(1);
  });

  it("zera tudo para cliente sem nada", () => {
    const m = calcMetricasCliente({ ...base, receitas: [], leads: [], tarefas: [] });
    expect(m).toMatchObject({
      mrrCentavos: 0,
      receitaTotalCentavos: 0,
      aReceberCentavos: 0,
      oportunidadesAbertas: 0,
      tarefasAbertas: 0,
      clienteDesde: "Mar 2026",
    });
  });
});

describe("montarTimeline", () => {
  const base = {
    clienteNome: "Mantegaria",
    criadoEm: dia(-40).toISOString(),
    interacoes: [],
    leads: [],
    tarefas: [],
    compromissos: [],
    receitas: [],
  };

  it("sempre tem ao menos o cadastro do cliente", () => {
    const t = montarTimeline(base);
    expect(t).toHaveLength(1);
    expect(t[0].tipo).toBe("CLIENTE_CRIADO");
  });

  it("ordena do mais recente para o mais antigo", () => {
    const t = montarTimeline({
      ...base,
      interacoes: [
        { id: "i1", tipo: "WHATSAPP", nota: "antiga", ocorreuEm: dia(-20).toISOString() },
        { id: "i2", tipo: "LIGACAO", nota: "recente", ocorreuEm: dia(-1).toISOString() },
      ],
    });
    expect(t.map((e) => e.detalhe)).toEqual(["recente", "antiga", "Mantegaria"]);
  });

  it("não inventa conclusão de tarefa sem carimbo de data", () => {
    const t = montarTimeline({
      ...base,
      tarefas: [tarefa({ done: true, concluidaEm: null })],
    });
    expect(t.some((e) => e.tipo === "TAREFA_CONCLUIDA")).toBe(false);
    expect(t.some((e) => e.tipo === "TAREFA_CRIADA")).toBe(true);
  });

  it("registra a conclusão quando a data existe", () => {
    const t = montarTimeline({
      ...base,
      tarefas: [tarefa({ done: true, concluidaEm: dia(-2).toISOString() })],
    });
    expect(t.some((e) => e.tipo === "TAREFA_CONCLUIDA")).toBe(true);
  });

  it("só marca pagamento recebido quando há data de recebimento", () => {
    const semData = montarTimeline({ ...base, receitas: [receita({ dataRecebida: null })] });
    const comData = montarTimeline({
      ...base,
      receitas: [receita({ dataRecebida: dia(-3).toISOString() })],
    });
    expect(semData.some((e) => e.tipo === "RECEITA_RECEBIDA")).toBe(false);
    expect(comData.some((e) => e.tipo === "RECEITA_RECEBIDA")).toBe(true);
  });

  it("inclui compromisso cumprido só com data", () => {
    const t = montarTimeline({
      ...base,
      compromissos: [compromisso({ cumprido: true, cumpridoEm: dia(-4).toISOString() })],
    });
    expect(t.filter((e) => e.tipo === "COMPROMISSO_CUMPRIDO")).toHaveLength(1);
  });
});

describe("proximaAcaoDoCliente", () => {
  it("devolve null sem nada em aberto", () => {
    expect(proximaAcaoDoCliente([], [])).toBeNull();
  });

  it("ignora tarefa concluída, sem prazo, e compromisso cumprido", () => {
    const r = proximaAcaoDoCliente(
      [tarefa({ id: "a", done: true }), tarefa({ id: "b", dueDate: null })],
      [compromisso({ cumprido: true })]
    );
    expect(r).toBeNull();
  });

  it("escolhe o que vence primeiro entre tarefa e compromisso", () => {
    const r = proximaAcaoDoCliente(
      [tarefa({ title: "Tarefa", dueDate: dia(6).toISOString() })],
      [compromisso({ descricao: "Compromisso", prazoEm: dia(2).toISOString() })]
    );
    expect(r?.titulo).toBe("Compromisso");
    expect(r?.quando).toBe("em 2 dias");
  });

  it("marca atraso", () => {
    const r = proximaAcaoDoCliente([tarefa({ dueDate: dia(-3).toISOString() })], []);
    expect(r?.atrasado).toBe(true);
  });
});

describe("ultimoContato", () => {
  it("devolve null sem contato nem interação", () => {
    expect(ultimoContato(null, [])).toBeNull();
  });

  it("usa a interação quando ela é mais recente que o campo manual", () => {
    const r = ultimoContato(dia(-10), [
      { id: "i", tipo: "LIGACAO", nota: "", ocorreuEm: dia(-2).toISOString() },
    ]);
    expect(fmtDataHumana(r)).toBe("há 2 dias");
  });

  it("mantém o campo manual quando ele é o mais recente", () => {
    const r = ultimoContato(dia(-1), [
      { id: "i", tipo: "LIGACAO", nota: "", ocorreuEm: dia(-9).toISOString() },
    ]);
    expect(fmtDataHumana(r)).toBe("Ontem");
  });
});

describe("isTipoInteracao", () => {
  it("aceita os tipos conhecidos e recusa o resto", () => {
    expect(isTipoInteracao("WHATSAPP")).toBe(true);
    expect(isTipoInteracao("STATUS")).toBe(true);
    expect(isTipoInteracao("POMBO_CORREIO")).toBe(false);
  });
});
