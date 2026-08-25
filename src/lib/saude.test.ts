import { describe, it, expect } from "vitest";
import {
  CONFIG_SAUDE,
  atendeFiltro,
  calcularSaudeCliente,
  ordemSaude,
  ultimoContatoEmMs,
  type ContextoSaude,
} from "./saude";

/** Data a N dias de hoje, ao meio-dia UTC para não escorregar de dia por fuso. */
function dia(offset: number): Date {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate() + offset, 12));
}

/** Primeiro dia do mês N meses atrás — formato de competência das receitas. */
function competencia(mesesAtras: number): Date {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - mesesAtras, 1));
}

function ctx(over: Partial<ContextoSaude> = {}): ContextoSaude {
  return {
    status: "active",
    criadoEm: dia(-200),
    ultimoContatoEm: null,
    interacoes: [],
    receitas: [],
    tarefas: [],
    compromissos: [],
    oportunidades: [],
    ...over,
  };
}

/** Contato registrado há N dias — o caminho normal, via interação. */
function contatoHa(dias: number) {
  return [{ tipo: "WHATSAPP", ocorreuEm: dia(-dias) }];
}

describe("faixas e score", () => {
  it("contato recente e nada pendente: Saudável", () => {
    const d = calcularSaudeCliente(ctx({ interacoes: contatoHa(2) }));
    expect(d.status).toBe("VERDE");
    expect(d.score).toBe(100);
    expect(d.motivos).toHaveLength(0);
    expect(d.sinaisPositivos).toContain("Último contato há 2 dias");
  });

  it("sem contato há 9 dias: Atenção, com o motivo explícito", () => {
    const d = calcularSaudeCliente(ctx({ interacoes: contatoHa(9) }));
    expect(d.status).toBe("AMARELO");
    expect(d.motivos[0].texto).toBe("Sem contato há 9 dias");
    expect(d.acaoRecomendada?.chave).toBe("REGISTRAR_CONTATO");
  });

  it("sem contato há 50 dias: Em risco sozinho", () => {
    const d = calcularSaudeCliente(ctx({ interacoes: contatoHa(50) }));
    expect(d.status).toBe("VERMELHO");
  });

  it("sinais somam: sem contato há 21 dias + 2 tarefas atrasadas viram risco", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(21),
        tarefas: [
          { done: false, dueDate: dia(-3) },
          { done: false, dueDate: dia(-8) },
        ],
      })
    );
    expect(d.status).toBe("VERMELHO");
    expect(d.motivos.map((m) => m.chave)).toEqual(["SEM_CONTATO", "TAREFAS_ATRASADAS"]);
    expect(d.motivos[1].texto).toBe("2 tarefas atrasadas");
    expect(d.tarefasAtrasadas).toBe(2);
  });

  it("sinal fraco não muda a faixa, mas fica registrado como motivo", () => {
    const d = calcularSaudeCliente(
      ctx({ interacoes: contatoHa(1), tarefas: [{ done: false, dueDate: dia(-1) }] })
    );
    expect(d.status).toBe("VERDE");
    expect(d.motivos[0].chave).toBe("TAREFAS_ATRASADAS");
    // Manchete de cliente saudável é o que o sustenta, não o sinal fraco.
    expect(d.resumo).toBe("Último contato há 1 dia");
  });

  it("motivos saem do mais grave para o menos", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(8),
        compromissos: [{ cumprido: false, prazoEm: dia(-10) }],
      })
    );
    expect(d.motivos[0].chave).toBe("COMPROMISSO_VENCIDO");
    expect(d.acaoRecomendada?.destino).toBe("/negocio/compromissos");
  });
});

describe("sem dados: ausência de informação não é saúde", () => {
  it("cliente novo sem nenhum histórico fica SEM_DADOS, não em risco", () => {
    const d = calcularSaudeCliente(ctx({ criadoEm: dia(-3) }));
    expect(d.status).toBe("SEM_DADOS");
    expect(d.resumo).toBe("Cadastrado há 3 dias, ainda sem contato registrado");
    expect(d.clienteNovo).toBe(true);
    expect(d.acaoRecomendada?.chave).toBe("REGISTRAR_CONTATO");
  });

  it("pagamento recebido não compra saúde: sem contato, segue SEM_DADOS", () => {
    const d = calcularSaudeCliente(
      ctx({
        criadoEm: dia(-4),
        receitas: [
          { tipo: "PONTUAL", status: "RECEBIDA", valorCentavos: 100000, competencia: competencia(0) },
        ],
      })
    );
    expect(d.status).toBe("SEM_DADOS");
    // O que os dados sustentam continua sendo dito — só não vira "Saudável".
    expect(d.sinaisPositivos).toContain("Pagamentos em dia");
  });

  it("cliente novo com problema real é diagnosticado, não protegido", () => {
    const d = calcularSaudeCliente(
      ctx({
        criadoEm: dia(-2),
        tarefas: [
          { done: false, dueDate: dia(-1) },
          { done: false, dueDate: dia(-4) },
        ],
      })
    );
    expect(d.status).toBe("AMARELO");
    expect(d.motivos[0].chave).toBe("TAREFAS_ATRASADAS");
  });

  it("cliente novo com contato registrado é diagnosticado normalmente", () => {
    const d = calcularSaudeCliente(
      ctx({
        criadoEm: dia(-3),
        interacoes: contatoHa(1),
        receitas: [
          { tipo: "RECORRENTE", status: "RECEBIDA", valorCentavos: 150000, competencia: competencia(0) },
        ],
      })
    );
    expect(d.status).toBe("VERDE");
    expect(d.mrrCentavos).toBe(150000);
  });

  it("cliente antigo sem nenhum contato registrado vira Atenção, não Saudável", () => {
    const d = calcularSaudeCliente(
      ctx({
        criadoEm: dia(-60),
        receitas: [
          { tipo: "RECORRENTE", status: "RECEBIDA", valorCentavos: 150000, competencia: competencia(0) },
        ],
      })
    );
    expect(d.status).toBe("AMARELO");
    expect(d.motivos[0].chave).toBe("SEM_HISTORICO_CONTATO");
  });

  it("cliente perdido sai do radar", () => {
    const d = calcularSaudeCliente(ctx({ status: "lost", criadoEm: dia(-300) }));
    expect(d.status).toBe("SEM_DADOS");
    expect(d.motivos).toHaveLength(0);
  });

  it("cliente arquivado sai do radar", () => {
    const d = calcularSaudeCliente(ctx({ arquivadoEm: dia(-1), criadoEm: dia(-300) }));
    expect(d.status).toBe("SEM_DADOS");
  });

  it("cliente antigo sem contato nenhum nunca é saudável", () => {
    const d = calcularSaudeCliente(ctx({ criadoEm: dia(-90), status: "inactive" }));
    expect(d.status).toBe("SEM_DADOS");
    expect(d.resumo).toBe("Nenhum contato registrado — sem base para diagnosticar");
  });

  it("inativo não é cobrado por silêncio, mas continua cobrado por dinheiro", () => {
    const semDinheiro = calcularSaudeCliente(
      ctx({ status: "inactive", interacoes: contatoHa(90) })
    );
    expect(semDinheiro.status).toBe("VERDE");

    const comVencido = calcularSaudeCliente(
      ctx({
        status: "inactive",
        interacoes: contatoHa(90),
        receitas: [
          { tipo: "PONTUAL", status: "CONFIRMADA", valorCentavos: 90000, competencia: competencia(2) },
        ],
      })
    );
    expect(comVencido.status).toBe("VERMELHO");
  });
});

describe("sinal financeiro (regras vêm de financeiro.ts)", () => {
  it("pagamento vencido há muito tempo derruba para risco", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(1),
        receitas: [
          { tipo: "RECORRENTE", status: "CONFIRMADA", valorCentavos: 120000, competencia: competencia(2) },
        ],
      })
    );
    expect(d.status).toBe("VERMELHO");
    expect(d.motivos[0].chave).toBe("PAGAMENTO_VENCIDO");
    expect(d.acaoRecomendada?.label).toBe("Cobrar pagamento");
    expect(d.valorVencidoCentavos).toBe(120000);
  });

  it("receita cancelada não conta como vencida", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(1),
        receitas: [
          { tipo: "PONTUAL", status: "CANCELADA", valorCentavos: 50000, competencia: competencia(3) },
        ],
      })
    );
    expect(d.status).toBe("VERDE");
    expect(d.receitasVencidas).toBe(0);
  });

  it("recorrência interrompida vira Atenção", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(1),
        receitas: [
          {
            tipo: "RECORRENTE",
            status: "RECEBIDA",
            valorCentavos: 200000,
            competencia: competencia(1),
            dataRecebida: dia(-30),
          },
        ],
      })
    );
    expect(d.status).toBe("AMARELO");
    expect(d.motivos[0].chave).toBe("RECORRENCIA_INTERROMPIDA");
  });
});

describe("sinal comercial (limiares vêm de pipeline.ts)", () => {
  it("oportunidade sem próxima ação e parada entra como motivo", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(1),
        oportunidades: [
          {
            estagio: "NEGOCIACAO",
            proximaAcao: null,
            proximaAcaoEm: null,
            estagioDesde: dia(-20),
            atualizadoEm: dia(-20),
          },
        ],
      })
    );
    expect(d.motivos[0].chave).toBe("OPORTUNIDADE_PARADA");
    expect(d.oportunidadesParadas).toBe(1);
    expect(d.acaoRecomendada?.label).toBe("Fazer follow-up");
  });

  it("oportunidade com próxima ação futura não está parada", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(1),
        oportunidades: [
          {
            estagio: "NEGOCIACAO",
            proximaAcao: "Enviar proposta",
            proximaAcaoEm: dia(3),
            estagioDesde: dia(-40),
            atualizadoEm: dia(-40),
          },
        ],
      })
    );
    expect(d.status).toBe("VERDE");
    expect(d.oportunidadesParadas).toBe(0);
    expect(d.sinaisPositivos).toContain("1 oportunidade em andamento");
  });

  it("ação comercial atrasada não é contada duas vezes como estagnação", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(1),
        oportunidades: [
          {
            estagio: "PROPOSTA_ENVIADA",
            proximaAcao: "Cobrar retorno",
            proximaAcaoEm: dia(-5),
            estagioDesde: dia(-40),
            atualizadoEm: dia(-40),
          },
        ],
      })
    );
    expect(d.motivos.map((m) => m.chave)).toEqual(["ACAO_COMERCIAL_ATRASADA"]);
  });
});

describe("contato", () => {
  it("observação e evento de sistema não contam como contato", () => {
    const ms = ultimoContatoEmMs(null, [
      { tipo: "NOTA", ocorreuEm: dia(-1) },
      { tipo: "STATUS", ocorreuEm: dia(-1) },
      { tipo: "SAUDE", ocorreuEm: dia(-1) },
    ]);
    expect(ms).toBeNull();
  });

  it("o campo manual antigo continua valendo como contato", () => {
    const d = calcularSaudeCliente(ctx({ ultimoContatoEm: dia(-3) }));
    expect(d.diasSemContato).toBe(3);
    expect(d.status).toBe("VERDE");
  });

  it("vale o contato mais recente entre campo manual e interações", () => {
    const d = calcularSaudeCliente(
      ctx({ ultimoContatoEm: dia(-30), interacoes: contatoHa(2) })
    );
    expect(d.diasSemContato).toBe(2);
  });
});

describe("ordenação e filtros", () => {
  it("a ordem de urgência é risco, atenção, sem dados e saudável", () => {
    expect(ordemSaude("VERMELHO")).toBeLessThan(ordemSaude("AMARELO"));
    expect(ordemSaude("AMARELO")).toBeLessThan(ordemSaude("SEM_DADOS"));
    expect(ordemSaude("SEM_DADOS")).toBeLessThan(ordemSaude("VERDE"));
  });

  it("filtros secundários leem o mesmo diagnóstico", () => {
    const d = calcularSaudeCliente(
      ctx({
        interacoes: contatoHa(30),
        tarefas: [{ done: false, dueDate: dia(-2) }],
      })
    );
    expect(atendeFiltro(d, "SEM_CONTATO")).toBe(true);
    expect(atendeFiltro(d, "PENDENCIA_ATRASADA")).toBe(true);
    expect(atendeFiltro(d, "PENDENCIA_FINANCEIRA")).toBe(false);
    expect(atendeFiltro(d, "OPORTUNIDADE_PARADA")).toBe(false);
  });

  it("os limiares do score são os configurados", () => {
    expect(CONFIG_SAUDE.LIMIAR_VERDE).toBe(80);
    expect(CONFIG_SAUDE.LIMIAR_AMARELO).toBe(50);
  });
});
