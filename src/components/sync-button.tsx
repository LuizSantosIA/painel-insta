"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertCircle, Trash2, LogIn } from "lucide-react";

type Msg = { ok: boolean; text: string };

export function SyncButton({ configured }: { configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const successDays = params.get("success");
  const errorMsg = params.get("error");

  const [syncLoading, setSyncLoading] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(
    successDays
      ? { ok: true, text: `Token conectado! Válido por ${successDays} dias.` }
      : errorMsg
      ? { ok: false, text: decodeURIComponent(errorMsg) }
      : null
  );

  async function sync() {
    setSyncLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Falha na sincronização" });
      } else {
        setMsg({ ok: true, text: `${data.upserted} posts sincronizados de ${data.fetched} encontrados.` });
        router.refresh();
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSyncLoading(false);
    }
  }

  async function cleanSeed() {
    if (!confirm("Remover todos os posts de exemplo do banco?")) return;
    setCleanLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/clean-seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Erro ao limpar" });
      } else {
        setMsg({ ok: true, text: `${data.deleted} posts de exemplo removidos.` });
        router.refresh();
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setCleanLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={sync}
          disabled={syncLoading || !configured}
          className="brand-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncLoading ? "animate-spin" : ""}`} />
          {syncLoading ? "Sincronizando..." : "Sincronizar agora"}
        </button>

        <a
          href="/api/auth/connect"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-2/80"
        >
          <LogIn className="h-4 w-4" />
          Conectar / renovar token
        </a>

        <button
          onClick={cleanSeed}
          disabled={cleanLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-surface-2/80 disabled:opacity-50"
        >
          <Trash2 className={`h-4 w-4 ${cleanLoading ? "animate-spin" : ""}`} />
          {cleanLoading ? "Removendo..." : "Limpar dados de exemplo"}
        </button>
      </div>

      {!configured && (
        <p className="text-xs text-muted">Configure o token no .env para habilitar a sincronização.</p>
      )}
      {msg && (
        <div className={`flex items-center gap-2 text-sm ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}