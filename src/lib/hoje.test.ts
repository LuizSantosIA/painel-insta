import { describe, it, expect } from "vitest";
import {
  DIAS_PROXIMOS,
  acaoDoAlerta,
  agendaDeHoje,
  fonteDoAlerta,
  montarBriefing,
  priorizarAtencao,
  proximosDias,
  resumoDoDia,
  saudacao,
  tarefasDeHoje,
  type CompromissoHoje,
  type TarefaHoje,
} from "./hoje";
import type { AlertaNegocio, Severidade } from "./negocio-overview";

/** Data a N dias de hoje, ao meio-dia local (hora cheia, para virar agenda). */
function dia(offset: number, hora = 12, minuto = 0): Date {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate() + offset, hora, minuto);
}

function alerta(over: Partial<AlertaNegocio> = {}): AlertaNegocio {
  return {
    id: "a1",
    titulo: "Título",
    detalhe: "detalhe",
    severidade: "ATENCAO" as Severidade,
    destino: "/negocio/tarefas",
    destinoLabel: "Tarefas",
    peso: 1,
    ...over,
  };
}

function tarefa(over: Partial<TarefaHoje> = {}): TarefaHoje {
  return {
    id: "t1",
    title: "Fazer algo",
    dueDate: dia(0),
    done: false,
    priority: "medium",
    ...over,
  };
}

function compromisso(over: Partial<CompromissoHoje> = {}): CompromissoHoje {
  return {
    id: "c1",
    descricao: "Reunião",
    para: "Cliente X",
    prazoEm: dia(0, 14, 0),
    cumprido: false,
    ...over,
  };
}

describe("saudacao", () => {
  it("muda com a hora local", () => {
    expect(saudacao(0)).toBe("Bom dia");
    expect(saudacao(11)).toBe("Bom dia");
    expect(saudacao(12)).toBe("Boa tarde");
    expect(saudacao(17)).toBe("Boa tarde");
    expect(saudacao(18)).toBe("Boa noite");
    expect(saudacao(23)).toBe("Boa noite");
  });
});

describe("fonte e ação derivadas do destino", () => {
  it("reconhece cada módulo pela rota", () => {
    expect(fonteDoAlerta("/negocio/financeiro")).toBe("FINANCEIRO");
    expect(fonteDoAlerta("/negocio/pipeline")).toBe("PIPELINE");
    expect(fonteDoAlerta("/negocio/saude")).toBe("CLIENTE");
    expect(fonteDoAlerta("/maquina/conversas")).toBe("MAQUINA");
    expect(fonteDoAlerta("/negocio/compromissos")).toBe("COMPROMISSO");
  });

  it("dá o verbo certo para cada origem", () => {
    expect(acaoDoAlerta("/negocio/financeiro")).toBe("Cobrar");
    expect(acaoDoAlerta("/negocio/pipeline")).toBe("Follow-up");
    expect(acaoDoAlerta("/negocio/saude")).toBe("Registrar contato");
    expect(acaoDoAlerta("/maquina/conversas")).toBe("Responder");
  });

  it("cai num padrão seguro para rota desconhecida", () => {
    expect(fonteDoAlerta("/rota/nova")).toBe("TAREFA");
    expect(acaoDoAlerta("/rota/nova")).toBe("Abrir");
  });
});

describe("priorizarAtencao", () => {
  it("põe todo urgente antes de qualquer atenção", () => {
    const itens = priorizarAtencao([
      alerta({ id: "atencao-pesada", severidade: "ATENCAO", peso: 900, destino: "/negocio/financeiro" }),
      alerta({ id: "urgente-leve", severidade: "URGENTE", peso: 1, destino: "/negocio/tarefas" }),
    ]);
    expect(itens.map((i) => i.id)).toEqual(["urgente-leve", "atencao-pesada"]);
  });

  it("dentro do mesmo nível, dinheiro vem antes de tarefa", () => {
    const itens = priorizarAtencao([
      alerta({ id: "tarefa", severidade: "URGENTE", destino: "/negocio/tarefas", peso: 5 }),
      alerta({ id: "dinheiro", severidade: "URGENTE", destino: "/negocio/financeiro", peso: 5 }),
    ]);
    expect(itens[0].id).toBe("dinheiro");
  });

  it("respeita a ordem completa das fontes no mesmo nível", () => {
    const itens = priorizarAtencao([
      alerta({ id: "f-tarefa", severidade: "URGENTE", destino: "/negocio/tarefas", peso: 1 }),
      alerta({ id: "e-pipeline", severidade: "URGENTE", destino: "/negocio/pipeline", peso: 1 }),
      alerta({ id: "d-maquina", severidade: "URGENTE", destino: "/maquina/conversas", peso: 1 }),
      alerta({ id: "c-cliente", severidade: "URGENTE", destino: "/negocio/saude", peso: 1 }),
      alerta({ id: "b-compromisso", severidade: "URGENTE", destino: "/negocio/compromissos", peso: 1 }),
      alerta({ id: "a-financeiro", severidade: "URGENTE", destino: "/negocio/financeiro", peso: 1 }),
    ]);
    expect(itens.map((i) => i.fonte)).toEqual([
      "FINANCEIRO",
      "COMPROMISSO",
      "CLIENTE",
      "MAQUINA",
      "PIPELINE",
      "TAREFA",
    ]);
  });

  it("desempata pelo peso: quem está atrasado há mais tempo sobe", () => {
    const itens = priorizarAtencao([
      alerta({ id: "novo", severidade: "URGENTE", destino: "/negocio/financeiro", peso: 2 }),
      alerta({ id: "velho", severidade: "URGENTE", destino: "/negocio/financeiro", peso: 40 }),
    ]);
    expect(itens[0].id).toBe("velho");
  });

  it("um atraso absurdo não fura a faixa da fonte", () => {
    const itens = priorizarAtencao([
      alerta({ id: "tarefa-antiga", severidade: "URGENTE", destino: "/negocio/tarefas", peso: 999_999_999 }),
      alerta({ id: "dinheiro-novo", severidade: "URGENTE", destino: "/negocio/financeiro", peso: 0 }),
    ]);
    expect(itens[0].id).toBe("dinheiro-novo");
  });

  it("é determinístico com entradas equivalentes", () => {
    const entrada = [
      alerta({ id: "b", severidade: "ATENCAO", destino: "/negocio/pipeline", peso: 3 }),
      alerta({ id: "a", severidade: "ATENCAO", destino: "/negocio/pipeline", peso: 3 }),
    ];
    expect(priorizarAtencao(entrada).map((i) => i.id)).toEqual(["a", "b"]);
    expect(priorizarAtencao([...entrada].reverse()).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("devolve lista vazia sem alertas", () => {
    expect(priorizarAtencao([])).toEqual([]);
  });
});

describe("agendaDeHoje", () => {
  it("mostra só compromissos de hoje ainda em aberto", () => {
    const itens = agendaDeHoje([
      compromisso({ id: "hoje" }),
      compromisso({ id: "amanha", prazoEm: dia(1, 10) }),
      compromisso({ id: "ontem", prazoEm: dia(-1, 10) }),
      compromisso({ id: "cumprido", cumprido: true }),
    ]);
    expect(itens.map((i) => i.id)).toEqual(["compromisso-hoje"]);
  });

  it("ordena por hora", () => {
    const itens = agendaDeHoje([
      compromisso({ id: "tarde", prazoEm: dia(0, 16, 30) }),
      compromisso({ id: "manha", prazoEm: dia(0, 9, 0) }),
    ]);
    expect(itens.map((i) => i.id)).toEqual(["compromisso-manha", "compromisso-tarde"]);
  });

  it("extrai a hora quando existe", () => {
    const itens = agendaDeHoje([compromisso({ prazoEm: dia(0, 14, 0) })]);
    expect(itens[0].hora).toBe("14:00");
  });

  it("trata meia-noite como sem hora marcada", () => {
    const itens = agendaDeHoje([compromisso({ prazoEm: dia(0, 0, 0) })]);
    expect(itens[0].hora).toBeNull();
  });
});

describe("tarefasDeHoje", () => {
  it("traz vencidas e as que vencem hoje, e ignora o resto", () => {
    const itens = tarefasDeHoje([
      tarefa({ id: "vencida", dueDate: dia(-3) }),
      tarefa({ id: "hoje", dueDate: dia(0) }),
      tarefa({ id: "amanha", dueDate: dia(1) }),
      tarefa({ id: "feita", dueDate: dia(0), done: true }),
      tarefa({ id: "sem-prazo", dueDate: null }),
    ]);
    expect(itens.map((i) => i.id)).toEqual(["vencida", "hoje"]);
  });

  it("marca o atraso", () => {
    const [t] = tarefasDeHoje([tarefa({ dueDate: dia(-2) })]);
    expect(t.atrasada).toBe(true);
    expect(t.diasAteVencer).toBe(-2);
  });

  it("no mesmo dia, prioridade alta vem antes", () => {
    const itens = tarefasDeHoje([
      tarefa({ id: "baixa", priority: "low" }),
      tarefa({ id: "alta", priority: "high" }),
      tarefa({ id: "media", priority: "medium" }),
    ]);
    expect(itens.map((i) => i.id)).toEqual(["alta", "media", "baixa"]);
  });

  it("a mais atrasada vem antes da que vence hoje", () => {
    const itens = tarefasDeHoje([
      tarefa({ id: "hoje", dueDate: dia(0), priority: "high" }),
      tarefa({ id: "atrasada", dueDate: dia(-5), priority: "low" }),
    ]);
    expect(itens[0].id).toBe("atrasada");
  });
});

describe("proximosDias", () => {
  it("mostra a janela seguinte, sem hoje e sem o que já passou", () => {
    const itens = proximosDias(
      [compromisso({ id: "amanha", prazoEm: dia(1) }), compromisso({ id: "hoje" })],
      [tarefa({ id: "depois", dueDate: dia(3) }), tarefa({ id: "ontem", dueDate: dia(-1) })]
    );
    expect(itens.map((i) => i.id)).toEqual(["compromisso-amanha", "tarefa-depois"]);
  });

  it("não passa da janela definida", () => {
    const itens = proximosDias([], [tarefa({ id: "longe", dueDate: dia(DIAS_PROXIMOS + 1) })]);
    expect(itens).toEqual([]);
  });

  it("respeita o limite de itens", () => {
    const muitas = Array.from({ length: 9 }, (_, i) =>
      tarefa({ id: `t${i}`, dueDate: dia(1) })
    );
    expect(proximosDias([], muitas)).toHaveLength(5);
    expect(proximosDias([], muitas, 2)).toHaveLength(2);
  });
});

describe("resumoDoDia", () => {
  it("lidera pelos urgentes", () => {
    expect(resumoDoDia({ urgentes: 2, atencao: 4, compromissosHoje: 1, tarefasHoje: 1 })).toBe(
      "2 itens urgentes e 4 ações pedindo atenção."
    );
  });

  it("usa singular quando é um só", () => {
    expect(resumoDoDia({ urgentes: 1, atencao: 0, compromissosHoje: 0, tarefasHoje: 0 })).toBe(
      "1 item urgente para resolver agora."
    );
  });

  it("fala de atenção quando não há urgência", () => {
    expect(resumoDoDia({ urgentes: 0, atencao: 3, compromissosHoje: 0, tarefasHoje: 0 })).toBe(
      "3 itens precisam da sua atenção hoje."
    );
  });

  it("tranquiliza quando só há coisas planejadas", () => {
    expect(resumoDoDia({ urgentes: 0, atencao: 0, compromissosHoje: 1, tarefasHoje: 2 })).toBe(
      "Tudo sob controle. Você tem 3 itens planejados para hoje."
    );
  });

  it("tem uma frase boa para o dia totalmente limpo", () => {
    expect(resumoDoDia({ urgentes: 0, atencao: 0, compromissosHoje: 0, tarefasHoje: 0 })).toBe(
      "Tudo sob controle. Nada exige sua atenção agora."
    );
  });
});

describe("montarBriefing", () => {
  it("conta por gravidade e por fonte", () => {
    const atencao = priorizarAtencao([
      alerta({ id: "1", severidade: "URGENTE", destino: "/negocio/financeiro" }),
      alerta({ id: "2", severidade: "ATENCAO", destino: "/negocio/pipeline" }),
      alerta({ id: "3", severidade: "ATENCAO", destino: "/maquina/conversas" }),
    ]);
    const b = montarBriefing({ agora: new Date(), atencao, agenda: [], tarefas: [], proximos: [] });

    expect(b.contagem.urgentes).toBe(1);
    expect(b.contagem.atencao).toBe(2);
    expect(b.porFonte.FINANCEIRO).toBe(1);
    expect(b.porFonte.MAQUINA).toBe(1);
    expect(b.porFonte.TAREFA).toBe(0);
  });

  it("traz o resumo já pronto e coerente com as contagens", () => {
    const b = montarBriefing({
      agora: new Date(),
      atencao: [],
      agenda: agendaDeHoje([compromisso()]),
      tarefas: tarefasDeHoje([tarefa()]),
      proximos: [],
    });
    expect(b.contagem).toMatchObject({ urgentes: 0, compromissosHoje: 1, tarefasHoje: 1 });
    expect(b.resumo).toBe("Tudo sob controle. Você tem 2 itens planejados para hoje.");
  });
});
