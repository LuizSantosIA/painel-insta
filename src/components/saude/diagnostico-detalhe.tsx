import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import { fmtDataHumana } from "@/lib/cliente-360";
import { corSaude, labelSaude, tomSaude, type DiagnosticoSaude } from "@/lib/saude";
import { Dot, Label, TRACO } from "@/components/negocio/panel";

/**
 * A explicação do diagnóstico: por que esta faixa, o que está bem e o que fazer.
 *
 * Componente só de apresentação — todo o conteúdo vem pronto da engine. É o mesmo
 * bloco no drawer da tela de Saúde e no perfil 360°, para a explicação não
 * divergir entre as duas telas.
 */

/** Ponto + rótulo da faixa, com o motivo principal ao lado. */
export function SaudeEtiqueta({
  diagnostico,
  compacto = false,
}: {
  diagnostico: DiagnosticoSaude;
  compacto?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Dot tom={tomSaude(diagnostico.status)} />
      <span
        className={`${compacto ? "text-[11px]" : "text-[12px]"} font-medium`}
        style={{ color: corSaude(diagnostico.status) }}
      >
        {labelSaude(diagnostico.status)}
      </span>
    </span>
  );
}

function ItemContexto({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label>{label}</Label>
      <span className="truncate text-[12.5px] tabular-nums text-foreground-2">{valor}</span>
    </div>
  );
}

export function DiagnosticoDetalhe({
  diagnostico,
  clienteId,
  mostrarLinkCliente = false,
}: {
  diagnostico: DiagnosticoSaude;
  clienteId: string;
  mostrarLinkCliente?: boolean;
}) {
  const d = diagnostico;

  return (
    <div className="space-y-4">
      {/* Motivos — nenhuma classificação sem explicação */}
      <div>
        <Label>{d.motivos.length > 0 ? "Motivos" : "Diagnóstico"}</Label>
        {d.motivos.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] text-foreground-2">{d.resumo}</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {d.motivos.map((m) => (
              <li key={m.chave} className="flex items-baseline gap-2 text-[12.5px] leading-tight">
                <Dot
                  tom={m.peso >= 40 ? "URGENTE" : "ATENCAO"}
                  className="translate-y-[-1px]"
                />
                <span className="min-w-0 text-foreground-2">{m.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sinais positivos — o que está indo bem também é diagnóstico */}
      {d.sinaisPositivos.length > 0 && (
        <div>
          <Label>Sinais positivos</Label>
          <ul className="mt-1.5 space-y-1">
            {d.sinaisPositivos.map((s) => (
              <li key={s} className="flex items-baseline gap-2 text-[12.5px] leading-tight">
                <Check
                  className="h-[11px] w-[11px] shrink-0 translate-y-[2px]"
                  style={{ color: "var(--success)" }}
                />
                <span className="min-w-0 text-foreground-2">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Contexto cru */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-subtle pt-3 sm:grid-cols-3">
        <ItemContexto
          label="MRR"
          valor={d.mrrCentavos > 0 ? `${fmtBRL(d.mrrCentavos)}/mês` : TRACO}
        />
        <ItemContexto label="Último contato" valor={fmtDataHumana(d.ultimaInteracaoEm)} />
        <ItemContexto
          label="Vencido"
          valor={d.valorVencidoCentavos > 0 ? fmtBRL(d.valorVencidoCentavos) : TRACO}
        />
        <ItemContexto
          label="Tarefas abertas"
          valor={
            d.tarefasAbertas === 0
              ? TRACO
              : `${d.tarefasAbertas}${d.tarefasAtrasadas > 0 ? ` · ${d.tarefasAtrasadas} atrasada${d.tarefasAtrasadas > 1 ? "s" : ""}` : ""}`
          }
        />
        <ItemContexto
          label="Compromissos vencidos"
          valor={d.compromissosVencidos > 0 ? String(d.compromissosVencidos) : TRACO}
        />
        <ItemContexto
          label="Oportunidades"
          valor={
            d.oportunidadesAbertas === 0
              ? TRACO
              : `${d.oportunidadesAbertas}${d.oportunidadesParadas > 0 ? ` · ${d.oportunidadesParadas} parada${d.oportunidadesParadas > 1 ? "s" : ""}` : ""}`
          }
        />
      </div>

      {mostrarLinkCliente && (
        <Link
          href={`/negocio/clientes/${clienteId}`}
          className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-brand transition-colors duration-150 hover:text-foreground focus-visible:outline-none"
        >
          Abrir cliente
          <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
