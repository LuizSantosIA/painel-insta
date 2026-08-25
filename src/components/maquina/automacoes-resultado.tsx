"use client";

import { useEffect, useState } from "react";
import { fmtBRL } from "@/lib/financeiro";
import type { AutomacoesLista } from "@/app/api/maquina/automacoes/route";
import { EmptyLine, Section, SectionHeader, TRACO } from "@/components/negocio/panel";
import { SectionSkeleton } from "@/components/negocio/skeletons";

/**
 * Automações vistas pelo resultado.
 *
 * "Executou 184 vezes" não é resultado. Resultado é a coluna da direita: quantas
 * dessas execuções viraram conversa, lead, oportunidade e dinheiro. Onde a cadeia
 * ainda não existe aparece "—", nunca um número estimado para preencher a linha.
 */

const GATILHO_LABEL: Record<string, string> = {
  COMENTARIO: "Comentário",
  DM: "Direct",
  AMBOS: "Comentário ou direct",
};

function fmtData(iso: string | null): string {
  if (!iso) return TRACO;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function AutomacoesResultado() {
  const [dados, setDados] = useState<AutomacoesLista | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    fetch("/api/maquina/automacoes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((json: AutomacoesLista) => {
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

  if (carregando) return <SectionSkeleton linhas={5} />;
  if (!dados) return null;

  const { automacoes, totais } = dados;
  const comExecucao = automacoes.filter((a) => a.execucoes > 0);

  return (
    <Section>
      <SectionHeader
        titulo="Resultado das automações"
        meta={
          automacoes.length > 0
            ? `${totais.ativas} ativas · ${totais.execucoes.toLocaleString("pt-BR")} execuções`
            : undefined
        }
      />

      {automacoes.length === 0 ? (
        <EmptyLine
          titulo="Nenhuma automação criada"
          descricao="Crie a primeira regra abaixo para a Máquina começar a conversar sozinha."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <Th>Automação</Th>
                <Th>Gatilho</Th>
                <Th>Ação</Th>
                <Th alinhar="right">Execuções</Th>
                <Th alinhar="right">Conversas</Th>
                <Th alinhar="right">Leads</Th>
                <Th alinhar="right">Oport.</Th>
                <Th alinhar="right">Receita</Th>
                <Th alinhar="right">Última</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/70">
              {automacoes.map((a) => (
                <tr key={a.id} className="transition-colors duration-150 hover:bg-surface-2/40">
                  <td className="py-[9px] pr-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
                        style={{ background: a.ativa ? "var(--success)" : "var(--muted-2)" }}
                        title={a.ativa ? "Ativa" : "Pausada"}
                      />
                      <span className="max-w-[180px] truncate text-[12.5px] text-foreground">
                        {a.nome}
                      </span>
                    </div>
                    <p className="mt-0.5 max-w-[200px] truncate text-[10.5px] text-muted-2">
                      {a.postAlvo ? `no post “${a.postAlvo.caption?.slice(0, 26) ?? "sem legenda"}”` : "em todos os posts"}
                    </p>
                  </td>
                  <td className="py-[9px] pr-3">
                    <p className="text-[11.5px] text-foreground-2">
                      {GATILHO_LABEL[a.gatilho] ?? a.gatilho}
                    </p>
                    <p className="max-w-[150px] truncate text-[10.5px] text-muted-2">
                      contém “{a.keywords}”
                    </p>
                  </td>
                  <td className="max-w-[190px] py-[9px] pr-3 text-[11.5px] text-muted">
                    <span className="block truncate" title={a.acao}>
                      {a.acao}
                    </span>
                  </td>
                  <Num valor={a.execucoes} />
                  <Num valor={a.conversas} />
                  <Num valor={a.leads} destaque />
                  <Num valor={a.oportunidades} destaque />
                  <td className="py-[9px] pr-3 text-right text-[12px] tabular-nums">
                    {a.receitaCentavos > 0 ? (
                      <span className="font-medium text-[color:var(--success)]">
                        {fmtBRL(a.receitaCentavos)}
                      </span>
                    ) : (
                      <span className="text-muted-2">{TRACO}</span>
                    )}
                  </td>
                  <td className="py-[9px] text-right text-[11px] text-muted-2">
                    {fmtData(a.ultimaExecucao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {comExecucao.length > 0 && totais.leads === 0 && (
            <p className="pt-3 text-[11px] text-muted-2">
              {totais.conversas.toLocaleString("pt-BR")} conversas nasceram destas automações e
              nenhuma virou lead ainda. A ponte é o botão “Transformar em lead” em Conversas — ou
              ligar “Gerar lead no pipeline” na regra.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

function Th({
  children,
  alinhar = "left",
}: {
  children?: React.ReactNode;
  alinhar?: "left" | "right";
}) {
  return (
    <th
      className={`pb-1.5 pr-3 text-[10px] font-medium uppercase tracking-[0.09em] text-muted-2 ${
        alinhar === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Num({ valor, destaque = false }: { valor: number; destaque?: boolean }) {
  return (
    <td className="py-[9px] pr-3 text-right text-[12px] tabular-nums">
      {valor > 0 ? (
        <span className={destaque ? "font-medium text-foreground" : "text-foreground-2"}>
          {valor.toLocaleString("pt-BR")}
        </span>
      ) : (
        <span className="text-muted-2">{TRACO}</span>
      )}
    </td>
  );
}
