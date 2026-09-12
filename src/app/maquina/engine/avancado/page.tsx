"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { LABEL_AGENTE, MODOS, type Agente } from "@/lib/engine/etapas";
import { EmptyLine, Section, SectionHeader } from "@/components/negocio/panel";
import { Carregando } from "@/components/engine/blocos";

/**
 * Área avançada: quem rodou, com que prompt, o que saiu, o que a máquina
 * aprendeu, o que o Radar encontrou, e o modo/teto. Fora da tela principal
 * de propósito — você não administra 11 agentes, só olha quando quer.
 */

interface Avancado {
  execucoes: {
    id: string; post: string | null; postId: string | null; agente: string; etapa: string | null; status: string;
    modelo: string; tokensIn: number; tokensOut: number; duracaoMs: number; erro: string | null; criadoEm: string;
    slideOrdem: number | null; prompt: string; saida: string;
  }[];
  fontes: { id: string; url: string; titulo: string | null; autor: string | null; plataforma: string | null; tema: string | null; resumo: string | null; porQueFunciona: string | null; origem: string; criadoEm: string }[];
  aprendizados: { id: string; origem: string; texto: string; tags: string; peso: number; ativo: boolean; criadoEm: string }[];
  estilos: { id: string; chave: string; nome: string; descricao: string; regras: string; usaAsset: boolean; ativo: boolean }[];
}

type Aba = "execucoes" | "fontes" | "aprendizados" | "estilos" | "config";

export default function AvancadoPage() {
  const [d, setD] = useState<Avancado | null>(null);
  const [config, setConfig] = useState<{ modoMaquina: string; tetoExecucoesDia: number } | null>(null);
  const [aba, setAba] = useState<Aba>("execucoes");
  const [aberta, setAberta] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    Promise.all([fetch("/api/maquina/engine/avancado").then((r) => r.json()), fetch("/api/maquina/engine/config").then((r) => r.json())])
      .then(([a, c]) => {
        if (ativo) {
          setD(a);
          setConfig(c);
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [versao]);

  async function salvarConfig(patch: Partial<{ modoMaquina: string; tetoExecucoesDia: number }>) {
    const r = await fetch("/api/maquina/engine/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (r.ok) setVersao((n) => n + 1);
  }

  const abas: { k: Aba; label: string }[] = [
    { k: "execucoes", label: "Execuções" },
    { k: "fontes", label: "Fontes" },
    { k: "aprendizados", label: "Aprendizados" },
    { k: "estilos", label: "Estilos" },
    { k: "config", label: "Modo" },
  ];

  const tokens = d ? d.execucoes.reduce((s, e) => s + e.tokensIn + e.tokensOut, 0) : 0;

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/maquina/engine" className="group inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" /> Máquina
      </Link>

      <header>
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Área avançada</h1>
        <p className="mt-0.5 text-[12px] text-muted">
          Execuções, prompts, fontes e aprendizados. Os agentes em si estão na{" "}
          <Link href="/maquina/engine/agentes" className="text-foreground-2 underline-offset-2 hover:underline">teia</Link>.
        </p>
      </header>

      <div className="flex gap-1.5">
        {abas.map((a) => (
          <button
            key={a.k}
            onClick={() => setAba(a.k)}
            className={`rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ${aba === a.k ? "bg-foreground text-background" : "border border-border text-muted hover:text-foreground"}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {!d && <Carregando />}

      {d && aba === "execucoes" && (
        <Section>
          <SectionHeader titulo="Execuções" meta={`${d.execucoes.length} recentes · ${tokens.toLocaleString("pt-BR")} tokens`} />
          {d.execucoes.length === 0 ? (
            <EmptyLine titulo="Nenhuma execução" descricao="Rode o Radar ou o dia para começar." />
          ) : (
            <div className="divide-y divide-border-subtle/70">
              {d.execucoes.map((e) => (
                <div key={e.id}>
                  <button onClick={() => setAberta(aberta === e.id ? null : e.id)} className="flex w-full items-baseline gap-2 py-[7px] text-left text-[12px] hover:bg-surface-2/40">
                    <span className={`h-[6px] w-[6px] shrink-0 translate-y-[-1px] rounded-full ${e.status === "ERRO" ? "bg-[color:var(--danger)]" : e.status === "ALERTA" ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"}`} />
                    <span className="w-[120px] shrink-0 text-foreground-2">{LABEL_AGENTE[e.agente as Agente] ?? e.agente}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {e.post ?? "—"}
                      {e.slideOrdem !== null && ` · slide ${e.slideOrdem}`}
                      {e.erro && <span className="text-[color:var(--danger)]"> · {e.erro}</span>}
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-muted-2 sm:inline">{e.modelo}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-2">{e.tokensIn + e.tokensOut}t · {(e.duracaoMs / 1000).toFixed(1)}s</span>
                    <span className="shrink-0 text-[11px] text-muted-2">{new Date(e.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </button>
                  {aberta === e.id && (
                    <div className="grid gap-3 pb-3 lg:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.09em] text-muted-2">prompt</p>
                        <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-[8px] bg-surface-2/60 p-2 text-[11px] text-muted">{e.prompt || "(sem prompt — execução determinística)"}</pre>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.09em] text-muted-2">saída</p>
                        <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-[8px] bg-surface-2/60 p-2 text-[11px] text-muted">{e.saida}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {d && aba === "fontes" && (
        <Section>
          <SectionHeader titulo="Fontes do Radar" meta={`${d.fontes.length}`} />
          {d.fontes.length === 0 ? (
            <EmptyLine titulo="Nenhuma fonte" descricao="Cole links na tela principal." />
          ) : (
            <div className="divide-y divide-border-subtle/70">
              {d.fontes.map((f) => (
                <div key={f.id} className="py-2 text-[12px]">
                  <div className="flex items-baseline gap-2">
                    <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline">{f.titulo ?? f.url}</a>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-2">{f.origem} · {f.plataforma ?? "?"}</span>
                  </div>
                  {f.resumo && <p className="mt-0.5 text-muted">{f.resumo}</p>}
                  {f.porQueFunciona && <p className="mt-0.5 text-[11px] text-muted-2">por que funciona: {f.porQueFunciona}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {d && aba === "aprendizados" && (
        <Section>
          <SectionHeader titulo="Aprendizados" meta={`${d.aprendizados.length}`} />
          {d.aprendizados.length === 0 ? (
            <EmptyLine titulo="A máquina ainda não aprendeu nada" descricao="Cada reprovação ou alteração sua vira um aprendizado." />
          ) : (
            <div className="divide-y divide-border-subtle/70">
              {d.aprendizados.map((a) => (
                <div key={a.id} className="flex items-baseline gap-2 py-[7px] text-[12px]">
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-2">{a.origem}</span>
                  <span className="min-w-0 flex-1 text-foreground-2">{a.texto}</span>
                  {a.tags && <span className="shrink-0 text-[11px] text-muted-2">{a.tags}</span>}
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-2">peso {a.peso}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {d && aba === "estilos" && (
        <Section>
          <SectionHeader titulo="Sistemas visuais" meta={`${d.estilos.length}`} />
          <div className="divide-y divide-border-subtle/70">
            {d.estilos.map((e) => (
              <div key={e.id} className="py-2 text-[12px]">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-foreground">{e.nome}</span>
                  <span className="font-mono text-[11px] text-muted-2">{e.chave}</span>
                  {e.usaAsset && <span className="text-[10px] uppercase tracking-wide text-[color:var(--warning)]">usa asset gerado</span>}
                </div>
                <p className="mt-0.5 text-muted">{e.descricao}</p>
                <p className="mt-0.5 text-[11px] text-muted-2">{e.regras}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d && config && aba === "config" && (
        <Section>
          <SectionHeader titulo="Modo de automação" />
          <div className="space-y-3 py-3 text-[12px]">
            <div className="flex flex-wrap gap-1.5">
              {MODOS.map((m) => (
                <button
                  key={m}
                  onClick={() => salvarConfig({ modoMaquina: m })}
                  className={`rounded-[8px] border px-3 py-1.5 font-medium transition-colors ${config.modoMaquina === m ? "border-brand/50 bg-brand/10 text-foreground" : "border-border text-muted hover:text-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">
              <span className="text-foreground-2">MANUAL</span> avança só no botão · <span className="text-foreground-2">COPILOTO</span> produz sozinho, você aprova · <span className="text-foreground-2">AUTOPILOT</span> também publica. Ligar Autopilot é decisão sua; a máquina nunca se coloca nele.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted">Teto de execuções por dia</span>
              <input
                type="number"
                min={1}
                max={1000}
                defaultValue={config.tetoExecucoesDia}
                onBlur={(e) => salvarConfig({ tetoExecucoesDia: Number(e.target.value) })}
                className="w-20 rounded-[8px] border border-border bg-surface-2 px-2 py-1 text-[12px] tabular-nums text-foreground-2 outline-none"
              />
              <span className="text-[11px] text-muted-2">a máquina para sozinha ao atingir</span>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
