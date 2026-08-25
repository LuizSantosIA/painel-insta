"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { EstadoIntegracao, IntegracoesResposta } from "@/app/api/maquina/integracoes/route";
import { Dot, Section, SectionHeader, TRACO, type Tom } from "@/components/negocio/panel";
import { SectionSkeleton } from "@/components/negocio/skeletons";

/**
 * Estado das conexões.
 *
 * O estado é verificado de verdade: a rota chama a Graph API e conta o que já
 * entrou no banco. "Conectada" aqui significa que respondeu agora, não que existe
 * uma variável de ambiente preenchida.
 */

const TOM: Record<EstadoIntegracao, Tom> = {
  CONECTADA: "OK",
  PARCIAL: "ATENCAO",
  DESCONECTADA: "URGENTE",
};

function fmtQuando(iso: string | null): string {
  if (!iso) return TRACO;
  const data = new Date(iso);
  const horas = (Date.now() - data.getTime()) / 3_600_000;
  if (horas < 1) return "há minutos";
  if (horas < 24) return `há ${Math.floor(horas)}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

export function StatusIntegracoes() {
  const [dados, setDados] = useState<IntegracoesResposta | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    fetch("/api/maquina/integracoes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((json: IntegracoesResposta) => {
        if (ativo) setDados(json);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) return <SectionSkeleton linhas={3} />;
  if (!dados) return null;

  const comProblema = dados.integracoes.filter((i) => i.problemas.length > 0).length;

  return (
    <Section>
      <SectionHeader
        titulo="Conexões"
        meta={
          comProblema > 0
            ? `${comProblema} ${comProblema === 1 ? "com problema" : "com problemas"}`
            : "todas em ordem"
        }
      />

      <div className="divide-y divide-border-subtle/70">
        {dados.integracoes.map((i) => (
          <div key={i.chave} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <Dot tom={TOM[i.estado]} className="translate-y-[-1px]" />
                <span className="text-[12.5px] font-medium text-foreground">{i.nome}</span>
                <span className="truncate text-[11.5px] text-muted">{i.resumo}</span>
              </div>
              <span className="shrink-0 text-[11px] text-muted-2">
                sincronizado {fmtQuando(i.ultimaSincronizacao)}
              </span>
            </div>

            <p className="mt-1 pl-3.5 text-[11.5px] text-muted-2">{i.descricao}</p>

            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 pl-3.5">
              {i.metricas.map((m) => (
                <span key={m.label} className="text-[11px] text-muted">
                  {m.label}{" "}
                  <span className="font-medium tabular-nums text-foreground-2">{m.valor}</span>
                </span>
              ))}
            </div>

            {i.problemas.map((p) => (
              <p
                key={p}
                className="mt-1.5 flex items-start gap-1.5 pl-3.5 text-[11.5px] text-[color:var(--warning)]"
              >
                <AlertTriangle className="mt-[1px] h-3 w-3 shrink-0" />
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}
