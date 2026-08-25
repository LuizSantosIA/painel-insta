"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import type { ConversaMaquina } from "@/lib/maquina-dados";

/**
 * Conversa → lead, sem digitar nada duas vezes.
 *
 * A conversa já sabe quem é a pessoa, de qual post ela veio e qual automação a
 * trouxe; o formulário só pede o que a API exige de qualquer oportunidade ativa:
 * linha de receita e próxima ação com data. O resto viaja junto.
 *
 * Quando já existe lead para o mesmo contato, a API devolve o lead existente em
 * vez de criar outro — e a tela avisa que apenas vinculou.
 */

const LINHAS = [
  { valor: "INNOBI", label: "Innobi" },
  { valor: "MENTORIA", label: "Mentoria" },
  { valor: "SERVICOS", label: "Serviços" },
];

function amanha(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function TransformarEmLead({
  conversa,
  onPronto,
}: {
  conversa: ConversaMaquina;
  onPronto: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [linha, setLinha] = useState("SERVICOS");
  const [proximaAcao, setProximaAcao] = useState("Qualificar lead do direct");
  const [proximaAcaoEm, setProximaAcaoEm] = useState(amanha());
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (conversa.lead) {
    return (
      <a
        href="/negocio/pipeline"
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition-colors hover:border-brand/35 hover:text-foreground"
      >
        No pipeline · {conversa.lead.estagio.toLowerCase()}
      </a>
    );
  }

  async function transformar() {
    setSalvando(true);
    setErro(null);
    try {
      const reais = valor.trim().replace(/\./g, "").replace(",", ".");
      const centavos = reais ? Math.round(Number(reais) * 100) : null;

      const r = await fetch(`/api/maquina/conversas/${conversa.id}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linhaInteresse: linha,
          proximaAcao: proximaAcao.trim(),
          proximaAcaoEm: new Date(`${proximaAcaoEm}T12:00:00Z`).toISOString(),
          valorEstimadoCentavos: centavos && centavos > 0 ? centavos : null,
        }),
      });

      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(json.error ?? "Não foi possível criar o lead");
        return;
      }

      if (json.criado === false) {
        setAviso("Já existia um lead para este contato — a conversa foi vinculada a ele.");
      }
      setAberto(false);
      onPronto();
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-brand/45 bg-brand/10 px-2.5 py-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-brand/15"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Transformar em lead
        </button>
        {aviso && <span className="max-w-[260px] text-right text-[10px] text-muted">{aviso}</span>}
      </div>
    );
  }

  return (
    <div className="w-[320px] rounded-[12px] border border-border bg-surface p-3.5">
      <p className="mb-2.5 text-[12px] font-semibold text-foreground">
        Novo lead · @{conversa.igUsername}
      </p>

      <div className="space-y-2.5">
        <select
          value={linha}
          onChange={(e) => setLinha(e.target.value)}
          className="w-full rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
        >
          {LINHAS.map((l) => (
            <option key={l.valor} value={l.valor}>
              {l.label}
            </option>
          ))}
        </select>

        <input
          value={proximaAcao}
          onChange={(e) => setProximaAcao(e.target.value)}
          placeholder="Próxima ação"
          className="w-full rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-foreground outline-none focus:border-brand/50"
        />

        <div className="flex gap-2">
          <input
            type="date"
            value={proximaAcaoEm}
            onChange={(e) => setProximaAcaoEm(e.target.value)}
            className="min-w-0 flex-1 rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
          />
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="Valor R$"
            className="w-[104px] rounded-[9px] border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-foreground-2 outline-none focus:border-brand/50"
          />
        </div>

        {conversa.postOrigem && (
          <p className="text-[10.5px] text-muted-2">
            Origem preservada: post “{conversa.postOrigem.caption?.slice(0, 34) ?? "sem legenda"}…”
            {conversa.automacaoOrigem ? ` · automação ${conversa.automacaoOrigem.nome}` : ""}
          </p>
        )}

        {erro && <p className="text-[11px] text-[color:var(--danger)]">{erro}</p>}

        <div className="flex justify-end gap-2 pt-0.5">
          <button
            onClick={() => setAberto(false)}
            className="rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={transformar}
            disabled={salvando || !proximaAcao.trim() || !proximaAcaoEm}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-brand/45 bg-brand/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-brand/15 disabled:opacity-60"
          >
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar lead
          </button>
        </div>
      </div>
    </div>
  );
}
