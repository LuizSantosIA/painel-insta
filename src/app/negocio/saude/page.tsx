"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import {
  FILTROS_SINAL,
  STATUS_SAUDE,
  atendeFiltro,
  labelSaude,
  type FiltroSinal,
  type StatusSaude,
} from "@/lib/saude";
import type { CarteiraSaude, ClienteSaudeItem } from "@/app/api/clientes/saude/route";
import { FaixaCarteira, type FiltroFaixa } from "@/components/saude/faixa-carteira";
import { CabecalhoCarteira, LinhaCliente } from "@/components/saude/linha-cliente";
import { DrawerDiagnostico } from "@/components/saude/drawer-diagnostico";
import { RegistrarContato } from "@/components/saude/registrar-contato";

/**
 * Saúde da carteira — um radar preventivo, não um cadastro de status.
 *
 * Nada é calculado nesta tela: o diagnóstico inteiro (faixa, motivos, sinais
 * positivos e ação recomendada) vem da engine em src/lib/saude.ts, a mesma que
 * responde a lista de Clientes, o perfil 360° e o painel de /negocio.
 */

const RESUMO_VAZIO = {
  vermelho: 0,
  amarelo: 0,
  verde: 0,
  semDados: 0,
  total: 0,
  mrrEmRiscoCentavos: 0,
};

type Composer = { item: ClienteSaudeItem; modo: "CONTATO" | "OBSERVACAO" } | null;

function isStatusSaude(v: string | null): v is StatusSaude {
  return v !== null && (STATUS_SAUDE as string[]).includes(v);
}

export default function SaudePage() {
  const [dados, setDados] = useState<CarteiraSaude | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(false);

  const [faixa, setFaixa] = useState<FiltroFaixa>("TODOS");
  const [sinais, setSinais] = useState<FiltroSinal[]>([]);
  const [menuFiltros, setMenuFiltros] = useState(false);
  const caixaFiltros = useRef<HTMLDivElement>(null);

  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/clientes/saude");
      if (!res.ok) throw new Error("falha");
      setDados(await res.json());
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Carga inicial. A releitura depois de uma ação passa por carregar(), que só é
  // chamada de dentro de um handler — efeito não dispara setState síncrono.
  useEffect(() => {
    let ativo = true;

    fetch("/api/clientes/saude")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((json: CarteiraSaude) => {
        if (ativo) setDados(json);
      })
      .catch(() => {
        if (ativo) setErro(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  // Veio do painel por uma faixa específica (/negocio/saude?faixa=VERMELHO).
  // Tem de ser efeito: ler a URL no render divergiria do HTML do servidor.
  useEffect(() => {
    const alvo = new URLSearchParams(window.location.search).get("faixa");
    if (!isStatusSaude(alvo)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única da URL no mount
    setFaixa(alvo);
  }, []);

  useEffect(() => {
    if (!menuFiltros) return;
    function fora(e: MouseEvent) {
      if (!caixaFiltros.current?.contains(e.target as Node)) setMenuFiltros(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menuFiltros]);

  const clientes = useMemo(() => dados?.clientes ?? [], [dados]);

  const visiveis = useMemo(
    () =>
      clientes.filter((c) => {
        if (faixa !== "TODOS" && c.diagnostico.status !== faixa) return false;
        return sinais.every((s) => atendeFiltro(c.diagnostico, s));
      }),
    [clientes, faixa, sinais]
  );

  const aberto = abertoId ? (clientes.find((c) => c.id === abertoId) ?? null) : null;

  function alternarSinal(chave: FiltroSinal) {
    setSinais((atual) =>
      atual.includes(chave) ? atual.filter((s) => s !== chave) : [...atual, chave]
    );
  }

  const resumo = dados?.resumo ?? RESUMO_VAZIO;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Saúde</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            Quem precisa da sua atenção, por quê e o que fazer agora
          </p>
        </div>
        <button
          onClick={() => {
            setAtualizando(true);
            carregar();
          }}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface-2/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground-2 transition-all duration-150 hover:border-brand/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 active:scale-[0.98]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? "animate-spin" : ""}`} />
          Reavaliar
        </button>
      </header>

      <FaixaCarteira
        resumo={resumo}
        ativo={faixa}
        onSelecionar={setFaixa}
        carregando={carregando}
      />

      {/* Filtros: faixa na barra principal, recortes por sinal dentro de Filtrar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["TODOS", ...STATUS_SAUDE] as FiltroFaixa[]).map((f) => (
            <button
              key={f}
              onClick={() => setFaixa(f)}
              className={`rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45 ${
                faixa === f
                  ? "bg-foreground text-background"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {f === "TODOS" ? "Todos" : labelSaude(f)}
            </button>
          ))}
        </div>

        <div className="relative ml-auto" ref={caixaFiltros}>
          <button
            onClick={() => setMenuFiltros((v) => !v)}
            aria-expanded={menuFiltros}
            aria-haspopup="menu"
            className={`inline-flex items-center gap-1.5 rounded-[7px] border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45 ${
              sinais.length > 0 || menuFiltros
                ? "border-brand/40 bg-brand/10 text-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filtrar
            {sinais.length > 0 && <span className="tabular-nums">· {sinais.length}</span>}
          </button>

          {menuFiltros && (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1.5 w-[268px] overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            >
              {FILTROS_SINAL.map((f) => {
                const ativo = sinais.includes(f.chave);
                return (
                  <button
                    key={f.chave}
                    role="menuitemcheckbox"
                    aria-checked={ativo}
                    onClick={() => alternarSinal(f.chave)}
                    className="flex w-full items-center gap-2 border-b border-border-subtle px-3 py-2 text-left text-[12px] transition-colors duration-150 last:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                        ativo ? "border-brand bg-brand/20" : "border-border"
                      }`}
                    >
                      {ativo && <Check className="h-2.5 w-2.5 text-brand" />}
                    </span>
                    <span className={ativo ? "text-foreground" : "text-foreground-2"}>
                      {f.label}
                    </span>
                  </button>
                );
              })}
              {sinais.length > 0 && (
                <button
                  onClick={() => setSinais([])}
                  className="w-full border-t border-border-subtle px-3 py-2 text-left text-[11px] text-muted transition-colors duration-150 hover:text-foreground"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 py-6 text-[12px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Avaliando a carteira…
        </div>
      ) : erro ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-danger/25 bg-danger/8 px-4 py-3 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Não foi possível avaliar a carteira. Recarregue a página.
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-wrap items-baseline gap-2 border-t border-border-subtle py-3">
          <span className="text-[12px] font-medium text-foreground-2">
            {clientes.length === 0 ? "Nenhum cliente na carteira" : "Nenhum cliente neste recorte"}
          </span>
          <span className="text-[12px] text-muted">
            {clientes.length === 0
              ? "O diagnóstico aparece assim que houver clientes cadastrados."
              : "Ajuste a faixa ou limpe os filtros."}
          </span>
        </div>
      ) : (
        <div>
          <CabecalhoCarteira />
          <div>
            {visiveis.map((item) => (
              <LinhaCliente
                key={item.id}
                item={item}
                onAbrir={() => setAbertoId(item.id)}
                onRegistrarContato={() => setComposer({ item, modo: "CONTATO" })}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-2">
            {visiveis.length} de {clientes.length}{" "}
            {clientes.length === 1 ? "cliente" : "clientes"} · ordenado por urgência
          </p>
        </div>
      )}

      {aberto && (
        <DrawerDiagnostico
          item={aberto}
          onFechar={() => setAbertoId(null)}
          onRegistrarContato={() => setComposer({ item: aberto, modo: "CONTATO" })}
          onAdicionarObservacao={() => setComposer({ item: aberto, modo: "OBSERVACAO" })}
        />
      )}

      {composer && (
        <RegistrarContato
          clienteId={composer.item.id}
          clienteNome={composer.item.name}
          modo={composer.modo}
          onFechar={() => setComposer(null)}
          onRegistrado={() => {
            setComposer(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
