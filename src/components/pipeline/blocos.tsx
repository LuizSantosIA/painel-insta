"use client";

import { fmtBRL } from "@/lib/financeiro";
import {
  MOTIVOS_PERDA,
  diasNoEstagio,
  fmtTempoNoEstagio,
  tomTempoParado,
  type ResumoPipeline,
  type TomParado,
} from "@/lib/pipeline";
import { diasParaVencer } from "@/lib/compromisso";
import type { LeadPipeline } from "@/app/api/pipeline/overview/route";

/**
 * Blocos novos do pipeline operacional.
 *
 * A página usa estilos inline (identidade própria da tela), então estes
 * componentes seguem a mesma convenção em vez de misturar dois sistemas.
 */

const COR_PARADO: Record<TomParado, string> = {
  NEUTRO: "#6b81a8",
  ATENCAO: "#F59E0B",
  RISCO: "#EF4444",
};

// ─── Faixa de resumo comercial ───────────────────────────────────────────────

export function ResumoComercial({ resumo }: { resumo: ResumoPipeline }) {
  const itens: { label: string; valor: string; atenuado?: boolean; dica?: string }[] = [
    { label: "Pipeline aberto", valor: resumo.totalCentavos > 0 ? fmtBRL(resumo.totalCentavos) : "—", atenuado: resumo.totalCentavos === 0 },
    { label: "Oportunidades", valor: String(resumo.quantidade), atenuado: resumo.quantidade === 0 },
    {
      label: "Ticket médio",
      valor: resumo.ticketMedioCentavos !== null ? fmtBRL(resumo.ticketMedioCentavos) : "—",
      atenuado: resumo.ticketMedioCentavos === null,
    },
    {
      label: "Ponderado",
      valor: resumo.ponderadoCentavos !== null ? fmtBRL(resumo.ponderadoCentavos) : "—",
      atenuado: resumo.ponderadoCentavos === null,
      dica: "precisa de probabilidade por oportunidade",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        background: "rgba(15,23,42,0.4)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {itens.map((item, i) => (
        <div
          key={item.label}
          style={{
            padding: "10px 16px",
            borderLeft: i > 0 ? "1px solid var(--border-subtle)" : undefined,
            minWidth: 0,
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              color: "var(--muted-2)",
              margin: 0,
            }}
          >
            {item.label}
          </p>
          <p
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
              color: item.atenuado ? "var(--muted-2)" : "var(--foreground)",
              margin: "5px 0 0",
              lineHeight: 1,
            }}
          >
            {item.valor}
          </p>
          {item.atenuado && item.dica && (
            <p style={{ fontSize: 10, color: "var(--muted-2)", margin: "4px 0 0" }}>{item.dica}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Conteúdo do card ────────────────────────────────────────────────────────

/** Prazo curto da próxima ação: "hoje", "amanhã", "atrasado 3d", "12 ago". */
function fmtPrazoAcao(em: string | null): { texto: string; atrasado: boolean } | null {
  if (!em) return null;
  const dias = diasParaVencer(em);
  if (dias < 0) return { texto: `atrasado ${Math.abs(dias)}d`, atrasado: true };
  if (dias === 0) return { texto: "hoje", atrasado: false };
  if (dias === 1) return { texto: "amanhã", atrasado: false };
  if (dias < 7) return { texto: `em ${dias} dias`, atrasado: false };
  return {
    texto: new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    atrasado: false,
  };
}

/**
 * Linhas de contexto do card, na ordem de prioridade pedida:
 * quem → quanto → situação → próxima ação.
 */
export function ContextoCard({ lead, corLinha }: { lead: LeadPipeline; corLinha?: string }) {
  const dias = diasNoEstagio(lead.estagioDesde);
  const tom = tomTempoParado(dias);
  const prazo = fmtPrazoAcao(lead.acao?.em ?? null);

  return (
    <>
      {/* quanto + linha de negócio */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        {lead.valorEstimadoCentavos != null && lead.valorEstimadoCentavos > 0 ? (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: "var(--foreground)",
            }}
          >
            {fmtBRL(lead.valorEstimadoCentavos)}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--muted-2)" }}>sem valor</span>
        )}
        {corLinha && (
          <span style={{ fontSize: 10, color: corLinha, letterSpacing: "0.03em" }}>
            {lead.linhaInteresse === "INNOBI" ? "Innobi" : lead.linhaInteresse === "MENTORIA" ? "Mentoria" : "Serviços"}
          </span>
        )}
      </div>

      {/* situação: há quanto tempo está parado neste estágio */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: COR_PARADO[tom],
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, color: COR_PARADO[tom] }}>
          {dias === null ? "tempo não registrado" : `${fmtTempoNoEstagio(dias)} neste estágio`}
        </span>
      </div>

      {/* próxima ação — ou a ausência dela, que é o sinal mais importante */}
      <div style={{ marginTop: 6 }}>
        {lead.acao ? (
          <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.35 }}>
            {lead.acao.titulo}
            {prazo && (
              <span style={{ color: prazo.atrasado ? "#EF4444" : "var(--muted-2)" }}> · {prazo.texto}</span>
            )}
          </p>
        ) : (
          <p style={{ fontSize: 11, color: "#F59E0B", margin: 0 }}>Sem próxima ação</p>
        )}
      </div>
    </>
  );
}

// ─── Zonas de finalização durante o arraste ──────────────────────────────────

/**
 * Aparecem só enquanto um card está sendo arrastado. Com Fechado e Perdido fora
 * das colunas fixas, é assim que a oportunidade continua a um arraste de virar
 * resultado — sem devolver duas colunas permanentes ao Kanban.
 */
export function ZonasFinalizacao({
  visivel,
  zonaAtiva,
  onZona,
  onSoltar,
}: {
  visivel: boolean;
  zonaAtiva: string | null;
  onZona: (zona: string | null) => void;
  onSoltar: (zona: string, leadId: string) => void;
}) {
  if (!visivel) return null;

  const zonas = [
    { key: "FECHADO", label: "Fechar negócio", cor: "#22C55E", simbolo: "✓" },
    { key: "PERDIDO", label: "Marcar como perdido", cor: "#EF4444", simbolo: "×" },
  ];

  return (
    <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
      {zonas.map((z) => {
        const ativa = zonaAtiva === z.key;
        return (
          <div
            key={z.key}
            onDragOver={(e) => {
              e.preventDefault();
              onZona(z.key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) onZona(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onZona(null);
              onSoltar(z.key, e.dataTransfer.getData("leadId"));
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px dashed ${ativa ? z.cor : "rgba(255,255,255,0.12)"}`,
              background: ativa ? `${z.cor}14` : "rgba(255,255,255,0.015)",
              color: ativa ? z.cor : "var(--muted)",
              fontSize: 12,
              fontWeight: 500,
              transition: "background 150ms, border-color 150ms, color 150ms",
            }}
          >
            <span style={{ fontSize: 14 }}>{z.simbolo}</span>
            {z.label}
          </div>
        );
      })}
    </div>
  );
}

// ─── Motivo da perda ─────────────────────────────────────────────────────────

export function ModalPerda({
  nome,
  salvando,
  onCancelar,
  onConfirmar,
}: {
  nome: string;
  salvando: boolean;
  onCancelar: () => void;
  onConfirmar: (motivo: string | null, nota: string) => void;
}) {
  return (
    <>
      <div
        onClick={onCancelar}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 60 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 61,
          width: "min(420px, calc(100vw - 32px))",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
          Marcar como perdido
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 14px" }}>
          {nome} — o motivo é opcional, mas ajuda a entender o padrão depois.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const dados = new FormData(e.currentTarget);
            const motivo = String(dados.get("motivo") ?? "");
            onConfirmar(motivo || null, String(dados.get("nota") ?? "").trim());
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {MOTIVOS_PERDA.map((m) => (
              <label key={m.key} style={{ cursor: "pointer" }}>
                <input type="radio" name="motivo" value={m.key} style={{ display: "none" }} />
                <span
                  className="motivo-chip"
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                  }}
                >
                  {m.label}
                </span>
              </label>
            ))}
          </div>

          <textarea
            name="nota"
            rows={2}
            placeholder="Observação (opcional)"
            style={{
              width: "100%",
              resize: "vertical",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12,
              color: "var(--foreground)",
              outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={onCancelar}
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                borderRadius: 10,
                padding: "8px 0",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              style={{
                flex: 2,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171",
                borderRadius: 10,
                padding: "8px 0",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                opacity: salvando ? 0.6 : 1,
              }}
            >
              {salvando ? "Salvando…" : "Marcar como perdido"}
            </button>
          </div>
        </form>

        <style>{`
          .motivo-chip:hover { border-color: rgba(239,68,68,0.35); color: #f87171; }
          input[name="motivo"]:checked + .motivo-chip {
            border-color: rgba(239,68,68,0.5);
            background: rgba(239,68,68,0.12);
            color: #f87171;
          }
        `}</style>
      </div>
    </>
  );
}
