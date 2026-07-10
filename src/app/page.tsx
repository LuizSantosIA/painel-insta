"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, CheckCircle, Flag, TrendingUp, Users, Clock, DollarSign, ChevronRight } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import { diasParaVencer, isVencido } from "@/lib/compromisso";
import { isAtrasado, ESTAGIOS_ATIVOS } from "@/lib/pipeline";
import { corSaude, labelSaude } from "@/lib/saude";
import type { ClienteSaudeItem } from "@/app/api/clientes/saude/route";

interface Compromisso {
  id: string; descricao: string; para: string;
  prazoEm: string; cumprido: boolean; cumpridoEm: string | null;
}
interface Lead {
  id: string; nome: string; estagio: string;
  proximaAcao: string | null; proximaAcaoEm: string | null;
  linhaInteresse: string;
}
interface Resumo {
  mrrAtual: number; mrrVariacao: number | null; runway: number | null; saldoCaixa: number;
}

type ItemUrgente = {
  tipo: "compromisso" | "lead";
  id: string;
  titulo: string;
  sub: string;
  dias: number;
  href: string;
};

const ESTAGIO_LABEL: Record<string, string> = {
  LEAD: "Lead", QUALIFICADO: "Qualificado", PROPOSTA_ENVIADA: "Proposta",
  NEGOCIACAO: "Negociação", FECHADO: "Fechado", PERDIDO: "Perdido",
};

const LINHA_COR: Record<string, string> = {
  INNOBI: "#4F8CFF", MENTORIA: "#7C5CFF", SERVICOS: "#00D4FF",
};

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function fmtDataHoje(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export default function HojePage() {
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saude, setSaude] = useState<ClienteSaudeItem[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/compromissos").then(r => r.ok ? r.json() : []),
      fetch("/api/leads").then(r => r.ok ? r.json() : []),
      fetch("/api/clientes/saude").then(r => r.ok ? r.json() : []),
      fetch("/api/financeiro/resumo").then(r => r.ok ? r.json() : null),
    ]).then(([c, l, s, r]) => {
      setCompromissos(c);
      setLeads(l);
      setSaude(s);
      setResumo(r);
      setLoading(false);
    });
  }, []);

  // ── Urgências ───────────────────────────────────────────────────────────
  const urgentes: ItemUrgente[] = [];
  const paraHoje: ItemUrgente[] = [];

  for (const c of compromissos) {
    if (c.cumprido) continue;
    const dias = diasParaVencer(c.prazoEm);
    if (dias < 0) {
      urgentes.push({ tipo: "compromisso", id: c.id, titulo: c.descricao, sub: `para ${c.para}`, dias, href: "/negocio/compromissos" });
    } else if (dias === 0) {
      paraHoje.push({ tipo: "compromisso", id: c.id, titulo: c.descricao, sub: `para ${c.para}`, dias, href: "/negocio/compromissos" });
    }
  }

  for (const l of leads) {
    if (!ESTAGIOS_ATIVOS.includes(l.estagio) || !l.proximaAcaoEm) continue;
    const dias = diasParaVencer(l.proximaAcaoEm);
    const item: ItemUrgente = {
      tipo: "lead", id: l.id,
      titulo: l.proximaAcao ?? "Próxima ação pendente",
      sub: `${l.nome} — ${ESTAGIO_LABEL[l.estagio] ?? l.estagio}`,
      dias, href: "/negocio/pipeline",
    };
    if (dias < 0) urgentes.push(item);
    else if (dias === 0) paraHoje.push(item);
  }

  urgentes.sort((a, b) => a.dias - b.dias);
  paraHoje.sort((a, b) => a.tipo.localeCompare(b.tipo));

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const leadsAtivos = leads.filter(l => ESTAGIOS_ATIVOS.includes(l.estagio));
  const pipelineCount: Record<string, number> = {};
  for (const l of leads) pipelineCount[l.estagio] = (pipelineCount[l.estagio] ?? 0) + 1;

  // ── Saúde ────────────────────────────────────────────────────────────────
  const vermelhos = saude.filter(c => c.saude === "VERMELHO");
  const amarelos = saude.filter(c => c.saude === "AMARELO");

  const tudoOk = urgentes.length === 0 && paraHoje.length === 0 && vermelhos.length === 0;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <Loader2 size={28} style={{ color: "#4F8CFF", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 800 }}>

      {/* ── Greeting ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: "#4a617f", textTransform: "capitalize", marginBottom: 2 }}>{fmtDataHoje()}</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5ff", margin: 0, letterSpacing: "-0.02em" }}>
          {saudacao()}, Chefe.
        </h1>
        {tudoOk ? (
          <p style={{ color: "#22C55E", fontSize: 14, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={15} /> Está tudo em ordem — nenhuma urgência hoje.
          </p>
        ) : (
          <p style={{ color: "#4a617f", fontSize: 14, marginTop: 6 }}>
            {urgentes.length > 0
              ? `${urgentes.length} item${urgentes.length > 1 ? "s" : ""} esperando sua atenção.`
              : "Nenhuma urgência atrasada — mas olhe o que tem para hoje."}
          </p>
        )}
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        <KpiCard
          icon={<DollarSign size={14} style={{ color: "#4F8CFF" }} />}
          label="MRR"
          value={resumo ? fmtBRL(resumo.mrrAtual) : "—"}
          sub={resumo?.mrrVariacao != null
            ? `${resumo.mrrVariacao >= 0 ? "+" : ""}${resumo.mrrVariacao.toFixed(1)}% vs mês ant.`
            : undefined}
          subColor={resumo?.mrrVariacao != null ? (resumo.mrrVariacao >= 0 ? "#22C55E" : "#f87171") : undefined}
          href="/negocio/financeiro"
        />
        <KpiCard
          icon={<TrendingUp size={14} style={{ color: "#7C5CFF" }} />}
          label="Leads ativos"
          value={String(leadsAtivos.length)}
          sub={urgentes.filter(u => u.tipo === "lead").length > 0
            ? `${urgentes.filter(u => u.tipo === "lead").length} com ação vencida`
            : "em dia"}
          subColor={urgentes.filter(u => u.tipo === "lead").length > 0 ? "#f87171" : "#22C55E"}
          href="/negocio/pipeline"
        />
        <KpiCard
          icon={<Clock size={14} style={{ color: "#F59E0B" }} />}
          label="Runway"
          value={resumo?.runway != null ? `${resumo.runway} meses` : "—"}
          sub={resumo?.runway != null
            ? resumo.runway < 3 ? "⚠ Crítico" : resumo.runway < 6 ? "Atenção" : "Saudável"
            : "Dados insuf."}
          subColor={resumo?.runway != null
            ? resumo.runway < 3 ? "#f87171" : resumo.runway < 6 ? "#fbbf24" : "#22C55E"
            : "#4a617f"}
          href="/negocio/financeiro"
        />
        <KpiCard
          icon={<Flag size={14} style={{ color: "#00D4FF" }} />}
          label="Compromissos"
          value={String(compromissos.filter(c => !c.cumprido).length)}
          sub={urgentes.filter(u => u.tipo === "compromisso").length > 0
            ? `${urgentes.filter(u => u.tipo === "compromisso").length} atrasado${urgentes.filter(u => u.tipo === "compromisso").length > 1 ? "s" : ""}`
            : "em dia"}
          subColor={urgentes.filter(u => u.tipo === "compromisso").length > 0 ? "#f87171" : "#22C55E"}
          href="/negocio/compromissos"
        />
      </div>

      {/* ── Urgente ── */}
      {urgentes.length > 0 && (
        <Section
          title="🚨 Fazer agora"
          subtitle={`${urgentes.length} item${urgentes.length > 1 ? "s" : ""} atrasado${urgentes.length > 1 ? "s" : ""}`}
          borderColor="#EF4444"
        >
          {urgentes.map(item => <ItemCard key={item.tipo + item.id} item={item} />)}
        </Section>
      )}

      {/* ── Para hoje ── */}
      {paraHoje.length > 0 && (
        <Section
          title="📅 Para hoje"
          subtitle={`${paraHoje.length} item${paraHoje.length > 1 ? "s" : ""} vence${paraHoje.length > 1 ? "m" : ""} hoje`}
          borderColor="#F59E0B"
        >
          {paraHoje.map(item => <ItemCard key={item.tipo + item.id} item={item} />)}
        </Section>
      )}

      {/* ── Pipeline ── */}
      {leads.length > 0 && (
        <Section title="📊 Pipeline" href="/negocio/pipeline">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["LEAD", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "FECHADO", "PERDIDO"] as const)
              .filter(s => pipelineCount[s])
              .map(s => {
                const CORES: Record<string, string> = {
                  LEAD: "#4F8CFF", QUALIFICADO: "#7C5CFF", PROPOSTA_ENVIADA: "#F59E0B",
                  NEGOCIACAO: "#F97316", FECHADO: "#22C55E", PERDIDO: "#6b82a8",
                };
                return (
                  <div key={s} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: `${CORES[s]}12`, border: `1px solid ${CORES[s]}30`,
                    borderRadius: 20, padding: "5px 12px",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CORES[s] }}>
                      {ESTAGIO_LABEL[s]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: CORES[s] }}>
                      {pipelineCount[s]}
                    </span>
                  </div>
                );
              })}
          </div>
          <p style={{ fontSize: 12, color: "#4a617f", marginTop: 8 }}>
            {leadsAtivos.length} lead{leadsAtivos.length !== 1 ? "s" : ""} ativo{leadsAtivos.length !== 1 ? "s" : ""}
            {urgentes.filter(u => u.tipo === "lead").length > 0
              ? ` · ${urgentes.filter(u => u.tipo === "lead").length} com ação vencida`
              : ""}
          </p>
        </Section>
      )}

      {/* ── Saúde ── */}
      {(vermelhos.length > 0 || amarelos.length > 0) && (
        <Section title="⚠ Saúde dos Clientes" href="/negocio/saude">
          {vermelhos.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#f87171", marginBottom: 6 }}>
                🔴 Em risco — {vermelhos.length} cliente{vermelhos.length > 1 ? "s" : ""}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {vermelhos.slice(0, 4).map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#e8f0ff" }}>{c.name}</span>
                    {c.temInadimplente && (
                      <span style={{ fontSize: 10, color: "#f87171", background: "rgba(239,68,68,0.1)", borderRadius: 6, padding: "1px 6px" }}>
                        inadimplente
                      </span>
                    )}
                    {c.mrrAtual > 0 && (
                      <span style={{ fontSize: 10, color: "#4a617f" }}>{fmtBRL(c.mrrAtual)}/mês</span>
                    )}
                  </div>
                ))}
                {vermelhos.length > 4 && (
                  <p style={{ fontSize: 11, color: "#4a617f" }}>+ {vermelhos.length - 4} mais</p>
                )}
              </div>
            </div>
          )}
          {amarelos.length > 0 && (
            <p style={{ fontSize: 12, color: "#fbbf24" }}>
              🟡 {amarelos.length} cliente{amarelos.length > 1 ? "s" : ""} em atenção
            </p>
          )}
        </Section>
      )}

      {/* ── Tudo ok ── */}
      {tudoOk && urgentes.length === 0 && vermelhos.length === 0 && (
        <div className="card" style={{ padding: "28px 24px", textAlign: "center", border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.04)" }}>
          <CheckCircle size={32} style={{ color: "#22C55E", margin: "0 auto 12px", display: "block" }} />
          <p style={{ fontSize: 14, color: "#4ade80", fontWeight: 600 }}>Tudo em ordem.</p>
          <p style={{ fontSize: 12, color: "#4a617f", marginTop: 4 }}>
            Nenhuma urgência, nenhum cliente em risco, pipeline em dia.
          </p>
        </div>
      )}

    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, subColor, href }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; subColor?: string; href: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="card"
        style={{ padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s" }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(79,140,255,0.3)")}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          {icon}
          <span style={{ fontSize: 10, fontWeight: 700, color: "#4a617f", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
        </div>
        <p style={{ fontSize: 20, fontWeight: 800, color: "#f1f5ff", margin: 0, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 10, color: subColor ?? "#4a617f", marginTop: 4, fontWeight: 600 }}>{sub}</p>}
      </div>
    </Link>
  );
}

function Section({ title, subtitle, borderColor, href, children }: {
  title: string; subtitle?: string; borderColor?: string;
  href?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#c8d4f0", margin: 0 }}>{title}</h2>
          {subtitle && (
            <span style={{ fontSize: 11, color: borderColor ?? "#4a617f", fontWeight: 600 }}>{subtitle}</span>
          )}
        </div>
        {href && (
          <Link href={href} style={{ fontSize: 11, color: "#4F8CFF", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
            Ver tudo <ChevronRight size={11} />
          </Link>
        )}
      </div>
      <div style={{
        background: "rgba(255,255,255,0.018)",
        border: `1px solid ${borderColor ? `${borderColor}25` : "rgba(255,255,255,0.05)"}`,
        borderLeft: `3px solid ${borderColor ?? "rgba(79,140,255,0.3)"}`,
        borderRadius: 14, padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {children}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: ItemUrgente }) {
  const vencido = item.dias < 0;
  const hoje = item.dias === 0;
  const corItem = item.tipo === "compromisso" ? "#00D4FF" : "#7C5CFF";

  return (
    <Link href={item.href} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: 10, transition: "background 0.15s",
        cursor: "pointer",
      }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(79,140,255,0.06)")}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "")}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: corItem, flexShrink: 0, boxShadow: `0 0 5px ${corItem}` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#e8f0ff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.titulo}
          </p>
          <p style={{ fontSize: 11, color: "#4a617f", margin: 0 }}>{item.sub}</p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, flexShrink: 0,
          color: vencido ? "#f87171" : hoje ? "#fbbf24" : "#4a617f",
        }}>
          {vencido ? `${Math.abs(item.dias)}d atrás` : "hoje"}
        </span>
        <ChevronRight size={12} style={{ color: "#2a3a52", flexShrink: 0 }} />
      </div>
    </Link>
  );
}
