"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function FacebookPageForm() {
  const [pageToken, setPageToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!pageToken.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/facebook/save-page-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageToken: pageToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Erro desconhecido" });
      } else {
        setMsg({ ok: true, text: `Página "${data.pageName}" conectada! DM liberado para qualquer comentarista.` });
        setPageToken("");
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
        <input
          type="text"
          value={pageToken}
          onChange={(e) => setPageToken(e.target.value)}
          placeholder="Cole o Page Access Token da sua Página do Facebook"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={save}
          disabled={loading || !pageToken.trim()}
          className="brand-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Conectando..." : "Conectar"}
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
