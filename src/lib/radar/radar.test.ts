import { describe, it, expect } from "vitest";
import {
  formatarTelefone,
  linkWhatsApp,
  normalizarTelefone,
  tipoDoTelefone,
  whatsAppDaUrl,
} from "./telefone";
import {
  avaliarCandidato,
  ehRedeNacional,
  filtrarLote,
  normalizarNome,
  REDES_PADRAO,
  type ContextoFiltro,
} from "./filtros";
import { montarInputMaps, traduzirItemMaps } from "./maps";

describe("normalizarTelefone", () => {
  it("aceita os formatos que o Google Maps devolve", () => {
    const esperado = "+5561999998888";
    for (const f of [
      "+55 61 99999-8888",
      "(61) 99999-8888",
      "61 99999 8888",
      "61999998888",
      "5561999998888",
      "+55 (61) 9 9999-8888",
    ]) {
      expect(normalizarTelefone(f)?.e164, f).toBe(esperado);
    }
  });

  it("separa celular de fixo pelo nono dígito", () => {
    expect(normalizarTelefone("61 99999-8888")?.tipo).toBe("CELULAR");
    expect(normalizarTelefone("61 3234-5678")?.tipo).toBe("FIXO");
    // 8 dígitos começando com 9 é celular antigo: sem o nono dígito não dá para
    // adivinhar o número atual, então não promovemos a celular.
    expect(normalizarTelefone("61 9999-8888")?.tipo).toBe("FIXO");
  });

  it("recusa o que não dá para discar", () => {
    for (const ruim of ["", null, undefined, "123", "11 1234", "00 99999-8888", "99 99999-88888888"]) {
      expect(normalizarTelefone(ruim), String(ruim)).toBeNull();
    }
  });

  it("recusa DDD inexistente", () => {
    expect(normalizarTelefone("20 99999-8888")).toBeNull();
    expect(normalizarTelefone("61 99999-8888")).not.toBeNull();
  });

  it("recusa número de dígito repetido", () => {
    expect(normalizarTelefone("61 99999-9999")).toBeNull();
  });

  it("tipoDoTelefone devolve SEM quando não há número", () => {
    expect(tipoDoTelefone(null)).toBe("SEM");
    expect(tipoDoTelefone("61 3234-5678")).toBe("FIXO");
  });

  it("formata para leitura", () => {
    expect(formatarTelefone("+5561999998888")).toBe("(61) 99999-8888");
    expect(formatarTelefone("+556132345678")).toBe("(61) 3234-5678");
  });

  it("monta o link do WhatsApp com a mensagem", () => {
    const l = linkWhatsApp("+5561999998888", "Olá, tudo bem?");
    expect(l).toBe("https://wa.me/5561999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F");
  });

  it("acha o WhatsApp escondido no link do site", () => {
    expect(whatsAppDaUrl("https://wa.me/5561999998888")?.e164).toBe("+5561999998888");
    expect(whatsAppDaUrl("https://api.whatsapp.com/send?phone=5561999998888&text=oi")?.e164).toBe("+5561999998888");
    expect(whatsAppDaUrl("tel:+5561999998888")?.e164).toBe("+5561999998888");
    expect(whatsAppDaUrl("https://instagram.com/loja")).toBeNull();
  });
});

describe("rede nacional", () => {
  it("pega a rede pelo nome", () => {
    expect(ehRedeNacional("Localiza Rent a Car")).toBe(true);
    expect(ehRedeNacional("MOVIDA Aluguel de Carros")).toBe(true);
    expect(ehRedeNacional("Brasal Veículos")).toBe(true);
    expect(ehRedeNacional("OdontoCompany Taguatinga")).toBe(true);
  });

  it("não derruba quem só tem a rede como pedaço de palavra", () => {
    // o motivo de casar por palavra inteira, não por substring
    expect(ehRedeNacional("Automovida Veículos")).toBe(false);
    expect(ehRedeNacional("Enfoco Imóveis")).toBe(false);
  });

  it("ignora acento e caixa", () => {
    expect(ehRedeNacional("IMPÉRIO Automóveis")).toBe(true);
  });

  it("respeita uma lista própria", () => {
    expect(ehRedeNacional("Loja do João", ["loja do joao"])).toBe(true);
    expect(ehRedeNacional("Localiza", [])).toBe(false);
  });

  it("normalizarNome tira acento, pontuação e espaço sobrando", () => {
    expect(normalizarNome("  Clínica  Odonto-Vida!! ")).toBe("clinica odonto vida");
  });
});

describe("avaliarCandidato", () => {
  const base = (): ContextoFiltro => ({
    optOut: new Set(),
    bloqueados: new Set(),
    jaConhecidos: new Set(),
    redes: REDES_PADRAO,
    minAvaliacoes: 30,
  });

  const bom = { placeId: "p1", nome: "Revenda do Zé", telefone: "61 99999-8888", totalAvaliacoes: 120 };

  it("aceita quem passa por tudo", () => {
    const v = avaliarCandidato(bom, base());
    expect(v.aceito).toBe(true);
    expect(v.e164).toBe("+5561999998888");
  });

  it("opt-out vence qualquer outra coisa", () => {
    const ctx = base();
    ctx.optOut.add("+5561999998888");
    ctx.bloqueados.add("p1");
    expect(avaliarCandidato(bom, ctx).motivo).toBe("OPT_OUT");
  });

  it("bloqueia por place_id ou por telefone", () => {
    const porId = base();
    porId.bloqueados.add("p1");
    expect(avaliarCandidato(bom, porId).motivo).toBe("BLOQUEADO");

    const porTel = base();
    porTel.bloqueados.add("+5561999998888");
    expect(avaliarCandidato(bom, porTel).motivo).toBe("BLOQUEADO");
  });

  it("descarta rede nacional e poucas avaliações", () => {
    expect(avaliarCandidato({ ...bom, nome: "Localiza DF" }, base()).motivo).toBe("REDE_NACIONAL");
    expect(avaliarCandidato({ ...bom, totalAvaliacoes: 29 }, base()).motivo).toBe("POUCAS_AVALIACOES");
    expect(avaliarCandidato({ ...bom, totalAvaliacoes: 30 }, base()).aceito).toBe(true);
    expect(avaliarCandidato({ ...bom, totalAvaliacoes: null }, base()).motivo).toBe("POUCAS_AVALIACOES");
  });

  it("descarta quem já está no pipeline", () => {
    const ctx = base();
    ctx.jaConhecidos.add("+5561999998888");
    expect(avaliarCandidato(bom, ctx).motivo).toBe("JA_NO_PIPELINE");
  });

  it("descarta quem não tem telefone discável", () => {
    expect(avaliarCandidato({ ...bom, telefone: null }, base()).motivo).toBe("SEM_CONTATO");
    expect(avaliarCandidato({ ...bom, telefone: "123" }, base()).motivo).toBe("SEM_CONTATO");
  });
});

describe("filtrarLote", () => {
  const ctx = (): ContextoFiltro => ({
    optOut: new Set(),
    bloqueados: new Set(),
    jaConhecidos: new Set(),
    redes: REDES_PADRAO,
    minAvaliacoes: 30,
  });

  it("deduplica o mesmo place_id", () => {
    const r = filtrarLote(
      [
        { placeId: "p1", nome: "Revenda A", telefone: "61 99999-8888", totalAvaliacoes: 50 },
        { placeId: "p1", nome: "Revenda A", telefone: "61 99999-8888", totalAvaliacoes: 50 },
      ],
      ctx()
    );
    expect(r.aceitos).toHaveLength(1);
    expect(r.contagem.DUPLICADO).toBe(1);
  });

  it("deduplica place_id diferente com o mesmo telefone — dois termos acham a mesma loja", () => {
    const r = filtrarLote(
      [
        { placeId: "p1", nome: "Revenda A", telefone: "61 99999-8888", totalAvaliacoes: 50 },
        { placeId: "p2", nome: "Revenda A Matriz", telefone: "(61) 99999-8888", totalAvaliacoes: 50 },
      ],
      ctx()
    );
    expect(r.aceitos).toHaveLength(1);
    expect(r.contagem.DUPLICADO).toBe(1);
  });

  it("conta cada motivo e devolve o lote limpo", () => {
    const r = filtrarLote(
      [
        { placeId: "p1", nome: "Revenda do Zé", telefone: "61 99999-8888", totalAvaliacoes: 120 },
        { placeId: "p2", nome: "Localiza DF", telefone: "61 98888-7777", totalAvaliacoes: 900 },
        { placeId: "p3", nome: "Loja Nova", telefone: "61 97777-6666", totalAvaliacoes: 4 },
        { placeId: "p4", nome: "Sem Fone", telefone: null, totalAvaliacoes: 80 },
        { placeId: "p5", nome: "Clínica Boa", telefone: "61 3234-5678", totalAvaliacoes: 60 },
      ],
      ctx()
    );
    expect(r.aceitos.map((a) => a.placeId)).toEqual(["p1", "p5"]);
    expect(r.contagem.REDE_NACIONAL).toBe(1);
    expect(r.contagem.POUCAS_AVALIACOES).toBe(1);
    expect(r.contagem.SEM_CONTATO).toBe(1);
    expect(r.descartados).toHaveLength(3);
  });

  it("lote vazio não quebra", () => {
    const r = filtrarLote([], ctx());
    expect(r.aceitos).toEqual([]);
    expect(r.contagem.DUPLICADO).toBe(0);
  });
});

describe("traduzirItemMaps", () => {
  const ctx = { cidadeBusca: "Brasília", ufPadrao: "DF" };

  it("traduz o item cru do actor", () => {
    const c = traduzirItemMaps(
      {
        placeId: "ChIJ123",
        title: "Revenda do Zé",
        address: "SIA Trecho 3",
        neighborhood: "SIA",
        city: "Brasília",
        state: "DF",
        phoneUnformatted: "+5561999998888",
        website: "https://revendadoze.com.br",
        totalScore: 4.6,
        reviewsCount: 230,
        categories: ["Revendedor de carros usados", "Concessionária"],
        reviews: [
          { text: "Demoraram pra responder no WhatsApp", stars: 2, publishedAtDate: "2026-10-01" },
          { text: "   ", stars: 5 },
        ],
      },
      ctx
    )!;
    expect(c.nome).toBe("Revenda do Zé");
    expect(c.telefoneE164).toBe("+5561999998888");
    expect(c.tipoTelefone).toBe("CELULAR");
    expect(c.whatsapp).toBe("+5561999998888");
    expect(c.categorias).toBe("Revendedor de carros usados, Concessionária");
    expect(c.avaliacoes).toHaveLength(1); // a vazia não entra
    expect(c.avaliacoes[0].texto).toContain("Demoraram");
  });

  it("prefere o WhatsApp do site quando o telefone do Maps é fixo", () => {
    const c = traduzirItemMaps(
      { placeId: "p", title: "Clínica", phone: "(61) 3234-5678", website: "https://wa.me/5561977776666" },
      ctx
    )!;
    expect(c.tipoTelefone).toBe("FIXO");
    expect(c.whatsapp).toBe("+5561977776666");
  });

  it("descarta item sem place_id, sem nome, ou fechado", () => {
    expect(traduzirItemMaps({ title: "Sem id" }, ctx)).toBeNull();
    expect(traduzirItemMaps({ placeId: "p" }, ctx)).toBeNull();
    expect(traduzirItemMaps({ placeId: "p", title: "Fechou", permanentlyClosed: true }, ctx)).toBeNull();
    expect(traduzirItemMaps({ placeId: "p", title: "Fechado hoje", temporarilyClosed: true }, ctx)).toBeNull();
  });

  it("cai para a cidade da busca quando o item não traz", () => {
    const c = traduzirItemMaps({ placeId: "p", title: "Loja" }, ctx)!;
    expect(c.cidade).toBe("Brasília");
    expect(c.uf).toBe("DF");
    expect(c.telefoneE164).toBeNull();
    expect(c.tipoTelefone).toBe("SEM");
  });

  it("corta em 10 avaliações", () => {
    const reviews = Array.from({ length: 25 }, (_, i) => ({ text: `avaliação ${i}`, stars: 4 }));
    const c = traduzirItemMaps({ placeId: "p", title: "Loja", reviews }, ctx)!;
    expect(c.avaliacoes).toHaveLength(10);
  });
});

describe("montarInputMaps", () => {
  it("divide o teto de resultados entre os termos e pede português", () => {
    const i = montarInputMaps({ termos: ["a", "b", "c", "d"], cidade: "Brasília", uf: "DF", maxResultados: 100 });
    expect(i.maxCrawledPlacesPerSearch).toBe(25);
    expect(i.locationQuery).toBe("Brasília, DF, Brasil");
    expect(i.language).toBe("pt-BR");
    expect(i.searchStringsArray).toHaveLength(4);
  });

  it("não divide por zero quando não há termo", () => {
    const i = montarInputMaps({ termos: [], cidade: "Brasília", uf: "DF", maxResultados: 50 });
    expect(i.maxCrawledPlacesPerSearch).toBe(50);
  });
});
