import { describe, it, expect } from "vitest";
import {
  DIAS_LEAD_PARADO,
  calcAReceberVencido,
  montarAlertas,
  montarProximos,
  resumirPipeline,
  resumirSaude,
  type ClienteSaudeOverview,
  type CompromissoOverview,
  type DadosAlertas,
  type LeadOverview,
  type ReceitaOverview,
  type TarefaOverview,
} from "./negocio-overview";
import { calcularSaudeCliente } from "./saude";

/** Data a N dias de hoje, ao meio-dia UTC para não escorregar de dia por fuso. */
function dia(offset: number): Date {
  const hoje = new Date();
  return new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + offset, 12)
  );
}

/** Primeiro dia de um mês N meses atrás — o formato de competência das receitas. */
function competencia(mesesAtras: number): Date {
  const hoje = new Date();
  return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - mesesAtras, 1));
}

function lead(over: Partial<LeadOverview> = {}): LeadOverview {
  return {
    id: "l1",
    nome: "Innobi",
    estagio: "PROPOSTA_ENVIADA",
    valorEstimadoCentavos: 500000,
    proximaAcao: "Enviar proposta",
    proximaAcaoEm: dia(3),
    atualizadoEm: dia(0),
    ...over,
  };
}

/**
 * Um cliente com diagnóstico de verdade: a faixa sai da engine, a partir de quantos
 * dias faz que houve contato. Assim o teste do painel não inventa uma saúde que a
 * engine não produziria.
 */
function clienteSaude(id: string, name: string, diasSemContato: number): ClienteSaudeOverview {
  return {
    id,
    name,
    diagnostico: calcularSaudeCliente({
      status: "active",
      criadoEm: dia(-200),
      ultimoContatoEm: null,
      interacoes: [{ tipo: "WHATSAPP", ocorreuEm: dia(-diasSemContato) }],
      receitas: [],
      tarefas: [],
      compromissos: [],
      oportunidades: [],
    }),
  };
}

function vazio(): DadosAlertas {
  return { leads: [], compromissos: [], tarefas: [], receitas: [], clientes: [] };
}

describe("montarAlertas", () => {
  it("não gera alerta quando está tudo no prazo", () => {
    const alertas = montarAlertas({
      ...vazio(),
      leads: [lead()],
      compromissos: [{ id: "c1", descricao: "Reunião", para: "X", prazoEm: dia(2), cumprido: false }],
      tarefas: [{ id: "t1", title: "Proposta", dueDate: dia(1), done: false, clienteNome: null }],
      clientes: [clienteSaude("cl1", "Ok", 1)],
    });
    expect(alertas).toEqual([]);
  });

  it("aponta compromisso vencido como urgente", () => {
    const alertas = montarAlertas({
      ...vazio(),
      compromissos: [{ id: "c1", descricao: "Enviar contrato", para: "João", prazoEm: dia(-3), cumprido: false }],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidade).toBe("URGENTE");
    expect(alertas[0].destino).toBe("/negocio/compromissos");
    expect(alertas[0].detalhe).toContain("há 3 dias");
  });

  it("ignora compromisso já cumprido", () => {
    const alertas = montarAlertas({
      ...vazio(),
      compromissos: [{ id: "c1", descricao: "Feito", para: "X", prazoEm: dia(-9), cumprido: true }],
    });
    expect(alertas).toEqual([]);
  });

  it("ignora tarefa concluída e tarefa sem prazo", () => {
    const alertas = montarAlertas({
      ...vazio(),
      tarefas: [
        { id: "t1", title: "Concluída", dueDate: dia(-5), done: true, clienteNome: null },
        { id: "t2", title: "Sem prazo", dueDate: null, done: false, clienteNome: null },
      ],
    });
    expect(alertas).toEqual([]);
  });

  it("trata receita inadimplente como urgente", () => {
    const alertas = montarAlertas({
      ...vazio(),
      receitas: [
        {
          id: "r1",
          descricao: "Mensalidade",
          valorCentavos: 100000,
          tipo: "PONTUAL",
          status: "INADIMPLENTE",
          competencia: competencia(0),
          clienteNome: "Cliente XYZ",
        },
      ],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].titulo).toBe("Cliente XYZ");
    expect(alertas[0].destino).toBe("/negocio/financeiro");
  });

  it("não alerta receita do mês corrente ainda não recebida", () => {
    const alertas = montarAlertas({
      ...vazio(),
      receitas: [
        {
          id: "r1",
          descricao: "Deste mês",
          valorCentavos: 100000,
          tipo: "PONTUAL",
          status: "CONFIRMADA",
          competencia: competencia(0),
          clienteNome: null,
        },
      ],
    });
    expect(alertas).toEqual([]);
  });

  it("alerta receita de mês passado que não foi recebida", () => {
    const alertas = montarAlertas({
      ...vazio(),
      receitas: [
        {
          id: "r1",
          descricao: "Atrasada",
          valorCentavos: 100000,
          tipo: "PONTUAL",
          status: "CONFIRMADA",
          competencia: competencia(2),
          clienteNome: null,
        },
      ],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidade).toBe("URGENTE");
  });

  it("aponta lead com próxima ação atrasada e não duplica com 'parado'", () => {
    const alertas = montarAlertas({
      ...vazio(),
      leads: [lead({ proximaAcaoEm: dia(-4), atualizadoEm: dia(-30) })],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].id).toBe("lead-acao-l1");
  });

  it("aponta lead parado como atenção", () => {
    const alertas = montarAlertas({
      ...vazio(),
      leads: [lead({ proximaAcaoEm: dia(5), atualizadoEm: dia(-DIAS_LEAD_PARADO - 1) })],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidade).toBe("ATENCAO");
    expect(alertas[0].id).toBe("lead-parado-l1");
  });

  it("ignora lead já fechado ou perdido", () => {
    const alertas = montarAlertas({
      ...vazio(),
      leads: [
        lead({ id: "a", estagio: "FECHADO", proximaAcaoEm: dia(-40), atualizadoEm: dia(-40) }),
        lead({ id: "b", estagio: "PERDIDO", proximaAcaoEm: dia(-40), atualizadoEm: dia(-40) }),
      ],
    });
    expect(alertas).toEqual([]);
  });

  it("classifica saúde de cliente por severidade e ignora os verdes", () => {
    const alertas = montarAlertas({
      ...vazio(),
      clientes: [
        clienteSaude("1", "Risco", 50),
        clienteSaude("2", "Atenção", 9),
        clienteSaude("3", "Saudável", 1),
      ],
    });
    expect(alertas).toHaveLength(2);
    expect(alertas[0].severidade).toBe("URGENTE");
    expect(alertas[1].severidade).toBe("ATENCAO");
  });

  it("não repete como saúde o que já virou alerta próprio", () => {
    // A tarefa vencida deste cliente derruba a saúde dele, mas já tem alerta em
    // Tarefas: contar de novo em Saúde seria dizer a mesma coisa duas vezes.
    const cliente = clienteSaude("cl9", "Com tarefa", 1);
    cliente.diagnostico = calcularSaudeCliente({
      status: "active",
      criadoEm: dia(-200),
      ultimoContatoEm: null,
      interacoes: [{ tipo: "WHATSAPP", ocorreuEm: dia(-1) }],
      receitas: [],
      tarefas: [
        { done: false, dueDate: dia(-9) },
        { done: false, dueDate: dia(-9) },
        { done: false, dueDate: dia(-9) },
      ],
      compromissos: [],
      oportunidades: [],
    });
    expect(cliente.diagnostico.status).toBe("AMARELO");

    const alertas = montarAlertas({
      ...vazio(),
      tarefas: [{ id: "t9", title: "Entregar", dueDate: dia(-9), done: false, clienteNome: "Com tarefa" }],
      clientes: [cliente],
    });
    expect(alertas.map((a) => a.destinoLabel)).toEqual(["Tarefas"]);
  });

  it("coloca todos os urgentes antes de qualquer atenção", () => {
    const alertas = montarAlertas({
      ...vazio(),
      // atenção com peso alto (90 dias parado) versus urgente com peso baixo (1 dia)
      leads: [lead({ proximaAcaoEm: dia(9), atualizadoEm: dia(-90) })],
      compromissos: [{ id: "c1", descricao: "Venceu ontem", para: "X", prazoEm: dia(-1), cumprido: false }],
    });
    expect(alertas.map((a) => a.severidade)).toEqual(["URGENTE", "ATENCAO"]);
  });

  it("ordena urgentes pelo maior atraso", () => {
    const alertas = montarAlertas({
      ...vazio(),
      compromissos: [
        { id: "novo", descricao: "1 dia", para: "X", prazoEm: dia(-1), cumprido: false },
        { id: "velho", descricao: "10 dias", para: "X", prazoEm: dia(-10), cumprido: false },
      ],
    });
    expect(alertas[0].id).toBe("compromisso-velho");
  });
});

describe("resumirPipeline", () => {
  const leads: LeadOverview[] = [
    lead({ id: "1", estagio: "LEAD", valorEstimadoCentavos: 100000 }),
    lead({ id: "2", estagio: "LEAD", valorEstimadoCentavos: 200000 }),
    lead({ id: "3", estagio: "NEGOCIACAO", valorEstimadoCentavos: null }),
    lead({ id: "4", estagio: "FECHADO", valorEstimadoCentavos: 900000 }),
  ];

  it("soma apenas os estágios ativos", () => {
    const r = resumirPipeline(leads);
    expect(r.quantidade).toBe(3);
    expect(r.totalCentavos).toBe(300000);
  });

  it("conta lead sem valor estimado sem somar dinheiro", () => {
    const negociacao = resumirPipeline(leads).estagios.find((e) => e.estagio === "NEGOCIACAO");
    expect(negociacao).toMatchObject({ quantidade: 1, valorCentavos: 0 });
  });

  it("sempre devolve os quatro estágios, mesmo zerados", () => {
    const r = resumirPipeline([]);
    expect(r.estagios).toHaveLength(4);
    expect(r.estagios.every((e) => e.quantidade === 0)).toBe(true);
    expect(r.totalCentavos).toBe(0);
  });
});

describe("resumirSaude", () => {
  it("conta cada faixa e o total", () => {
    const clientes: ClienteSaudeOverview[] = [
      clienteSaude("1", "a", 50),
      clienteSaude("2", "b", 9),
      clienteSaude("3", "c", 1),
      clienteSaude("4", "d", 1),
    ];
    expect(resumirSaude(clientes)).toEqual({
      vermelho: 1,
      amarelo: 1,
      verde: 2,
      semDados: 0,
      total: 4,
      mrrEmRiscoCentavos: 0,
    });
  });

  it("devolve tudo zerado sem clientes", () => {
    expect(resumirSaude([])).toEqual({
      vermelho: 0,
      amarelo: 0,
      verde: 0,
      semDados: 0,
      total: 0,
      mrrEmRiscoCentavos: 0,
    });
  });
});

describe("montarProximos", () => {
  const tarefas: TarefaOverview[] = [
    { id: "t1", title: "Amanhã", dueDate: dia(1), done: false, clienteNome: null },
    { id: "t2", title: "Vencida", dueDate: dia(-2), done: false, clienteNome: null },
    { id: "t3", title: "Concluída", dueDate: dia(1), done: true, clienteNome: null },
    { id: "t4", title: "Sem prazo", dueDate: null, done: false, clienteNome: null },
  ];
  const compromissos: CompromissoOverview[] = [
    { id: "c1", descricao: "Hoje", para: "X", prazoEm: dia(0), cumprido: false },
  ];

  it("mostra só o que ainda vai vencer, do mais próximo ao mais distante", () => {
    const itens = montarProximos(tarefas, compromissos);
    expect(itens.map((i) => i.titulo)).toEqual(["Hoje", "Amanhã"]);
  });

  it("marca o tipo de cada item", () => {
    const itens = montarProximos(tarefas, compromissos);
    expect(itens[0].tipo).toBe("Compromisso");
    expect(itens[1].tipo).toBe("Tarefa");
  });

  it("rotula hoje e amanhã por extenso", () => {
    const itens = montarProximos(tarefas, compromissos);
    expect(itens[0].quando).toBe("Hoje");
    expect(itens[1].quando).toBe("Amanhã");
  });

  it("respeita o limite de itens", () => {
    const muitas: TarefaOverview[] = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`,
      title: `Tarefa ${i}`,
      dueDate: dia(i + 1),
      done: false,
      clienteNome: null,
    }));
    expect(montarProximos(muitas, [])).toHaveLength(5);
    expect(montarProximos(muitas, [], 3)).toHaveLength(3);
  });
});

describe("calcAReceberVencido", () => {
  const receitas: ReceitaOverview[] = [
    { id: "1", descricao: "passada", valorCentavos: 300000, tipo: "PONTUAL", status: "CONFIRMADA", competencia: competencia(1), clienteNome: null },
    { id: "2", descricao: "deste mês", valorCentavos: 500000, tipo: "PONTUAL", status: "CONFIRMADA", competencia: competencia(0), clienteNome: null },
    { id: "3", descricao: "paga", valorCentavos: 900000, tipo: "PONTUAL", status: "RECEBIDA", competencia: competencia(2), clienteNome: null },
  ];

  it("soma só o que passou da competência e não foi recebido", () => {
    expect(calcAReceberVencido(receitas)).toBe(300000);
  });

  it("devolve zero sem receitas", () => {
    expect(calcAReceberVencido([])).toBe(0);
  });
});
