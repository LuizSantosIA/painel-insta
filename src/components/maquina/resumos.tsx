import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import { COR_STATUS_CONVERSA, LABEL_STATUS_CONVERSA } from "@/lib/maquina";
import type { AutomacaoMaquina, ConteudoMaquina, ConversaMaquina } from "@/lib/maquina-dados";
import { EmptyLine, LINHA_HOVER, Section, SectionHeader } from "@/components/negocio/panel";

/**
 * Blocos de resumo da visão geral da Máquina.
 *
 * Todos seguem a mesma régua do Negócio: seção sem caixa, régua no cabeçalho,
 * linhas densas, número à direita. O que muda é o que cada linha responde.
 */

function tituloConteudo(c: ConteudoMaquina): string {
  const texto = c.caption?.trim();
  if (!texto) return "Sem legenda";
  return texto.length > 68 ? `${texto.slice(0, 68)}…` : texto;
}

/** Conteúdos ordenados pelo que geraram, não pelo que curtiram. */
export function ConteudoDestaque({ conteudos }: { conteudos: ConteudoMaquina[] }) {
  const comResultado = conteudos.filter((c) => c.atribuicao.conversas > 0 || c.atribuicao.leads > 0);
  const lista = comResultado.length > 0 ? comResultado : conteudos;

  return (
    <Section>
      <SectionHeader
        titulo="Conteúdo que gera negócio"
        meta={comResultado.length > 0 ? "por conversas iniciadas" : undefined}
        href="/maquina/conteudo"
        hrefLabel="Ver conteúdo"
      />

      {lista.length === 0 ? (
        <EmptyLine
          titulo="Nenhum conteúdo publicado"
          descricao="Sincronize o Instagram na página de Integrações."
        />
      ) : comResultado.length === 0 ? (
        <EmptyLine
          titulo="Nenhum conteúdo gerou conversa ainda"
          descricao="Automações com DM são o caminho mais curto entre post e conversa."
          tom="ATENCAO"
        />
      ) : (
        <div className="divide-y divide-border-subtle/70">
          {lista.map((c) => (
            <Link
              key={c.id}
              href="/maquina/conteudo"
              className={`flex items-center gap-3 py-[7px] ${LINHA_HOVER}`}
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                {tituloConteudo(c)}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted">
                {c.atribuicao.conversas} conv.
              </span>
              <span
                className={`w-[58px] shrink-0 text-right text-[11px] font-medium tabular-nums ${
                  c.atribuicao.leads > 0 ? "text-[color:var(--success)]" : "text-muted-2"
                }`}
              >
                {c.atribuicao.leads > 0 ? `${c.atribuicao.leads} leads` : "—"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

/** Automações medidas pelo resultado. Execução sozinha não é resultado. */
export function AutomacoesResumo({ automacoes }: { automacoes: AutomacaoMaquina[] }) {
  return (
    <Section>
      <SectionHeader
        titulo="Automações"
        meta={automacoes.length > 0 ? "execuções → conversas" : undefined}
        href="/maquina/automacoes"
        hrefLabel="Ver automações"
      />

      {automacoes.length === 0 ? (
        <EmptyLine
          titulo="Nenhuma automação disparou ainda"
          descricao="Uma regra ativa só aparece aqui depois da primeira execução."
        />
      ) : (
        <div className="divide-y divide-border-subtle/70">
          {automacoes.map((a) => (
            <Link
              key={a.id}
              href="/maquina/automacoes"
              className={`flex items-center gap-3 py-[7px] ${LINHA_HOVER}`}
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{a.nome}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted">
                {a.execucoes.toLocaleString("pt-BR")} exec.
              </span>
              <span
                className={`w-[62px] shrink-0 text-right text-[11px] font-medium tabular-nums ${
                  a.conversas > 0 ? "text-foreground-2" : "text-muted-2"
                }`}
              >
                {a.conversas > 0 ? `${a.conversas} conv.` : "—"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

/** Conversas paradas esperando por mim — a fila mais cara de ignorar. */
export function ConversasAbertas({ conversas }: { conversas: ConversaMaquina[] }) {
  return (
    <Section>
      <SectionHeader
        titulo="Conversas aguardando você"
        meta={conversas.length > 0 ? `${conversas.length} na fila` : undefined}
        href="/maquina/conversas"
        hrefLabel="Abrir conversas"
      />

      {conversas.length === 0 ? (
        <EmptyLine titulo="Nenhuma conversa parada" descricao="Tudo respondido." tom="OK" />
      ) : (
        <div className="divide-y divide-border-subtle/70">
          {conversas.map((c) => (
            <Link
              key={c.id}
              href="/maquina/conversas"
              className={`flex items-center gap-3 py-[7px] ${LINHA_HOVER}`}
            >
              <span className="shrink-0 text-[12.5px] font-medium text-foreground">
                @{c.igUsername}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                {c.ultimaMensagem?.texto || "sem mensagens"}
              </span>
              <span
                className="shrink-0 text-[10px] font-medium uppercase tracking-[0.06em]"
                style={{ color: COR_STATUS_CONVERSA[c.status] }}
              >
                {LABEL_STATUS_CONVERSA[c.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

/** Onde a receita atribuída aparece sem virar uma segunda fonte financeira. */
export function ReceitaAtribuida({
  centavos,
  clientes,
}: {
  centavos: number | null;
  clientes: number;
}) {
  return (
    <Section>
      <SectionHeader titulo="Receita atribuída" href="/negocio/financeiro" hrefLabel="Financeiro" />

      {centavos === null ? (
        <EmptyLine
          titulo="Atribuição desconhecida"
          descricao="Nenhuma receita pôde ser ligada a um conteúdo. A cadeia completa é post → lead → cliente → receita."
        />
      ) : (
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <span className="text-[27px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {fmtBRL(centavos)}
          </span>
          <span className="text-[11px] text-muted">
            de {clientes} {clientes === 1 ? "cliente" : "clientes"} vindos da Máquina
          </span>
        </div>
      )}
    </Section>
  );
}

/** Ponte para as métricas de audiência, que continuam existindo em /maquina/instagram. */
export function LinkAudiencia() {
  return (
    <Link
      href="/maquina/instagram"
      className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:text-brand"
    >
      Métricas de audiência do Instagram
      <ArrowUpRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}
