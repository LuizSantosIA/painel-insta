"use client";

import { useState } from "react";
import { KeyRound, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function TokenForm() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function exchange() {
    if (!token.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Erro desconhecido" });
      } else {
        setMsg({ ok: true, text: `Token salvo! Válido por ${data.days} dias.` });
        setToken("");
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole aqui o token curto gerado no portal do Meta"
            className="w-full rounded-lg border border-border bg-surface-2 py-2.5 pl-9 pr-4 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          onClick={exchange}
          disabled={loading || !token.trim()}
          className="brand-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Trocando..." : "Ativar 60 dias"}
        </button>
      </div>
      {msg && (
        <div className={`flex items-center gap-2 text-sm ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}