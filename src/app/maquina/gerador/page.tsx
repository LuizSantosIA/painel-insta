"use client";

import { useState } from "react";
import { Wand2, Copy, Check, Loader2, AlertCircle } from "lucide-react";

type PostType = "REELS" | "CAROUSEL_ALBUM" | "IMAGE";
type Tone = "educativo" | "inspiracional" | "promocional" | "casual";

interface CaptionOption {
  text: string;
}

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: "REELS", label: "Reel" },
  { value: "CAROUSEL_ALBUM", label: "Carrossel" },
  { value: "IMAGE", label: "Foto" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "educativo", label: "Educativo" },
  { value: "inspiracional", label: "Inspiracional" },
  { value: "promocional", label: "Promocional" },
  { value: "casual", label: "Casual" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand hover:text-brand"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

export default function GeradorPage() {
  const [type, setType] = useState<PostType>("REELS");
  const [tone, setTone] = useState<Tone>("educativo");
  const [topic, setTopic] = useState("");
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<CaptionOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setOptions([]);
    try {
      const res = await fetch("/api/gerar-legenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, tone, topic: topic.trim(), includeHashtags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar legendas.");
      } else {
        setOptions(data.options ?? []);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gerador de legenda</h1>
        <p className="text-sm text-muted">
          A IA analisa seus posts com mais engajamento e gera 3 opções de legenda no seu estilo.
        </p>
      </header>

      <div className="card p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Tipo de post</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PostType)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              {POST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Tom desejado</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted">Tema ou assunto do post</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: dicas de produtividade para empreendedores, lançamento do meu curso online, bastidores da produção do meu vídeo..."
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted outline-none focus:border-brand"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <div
            onClick={() => setIncludeHashtags((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              includeHashtags ? "bg-brand" : "bg-surface-2 border border-border"
            }`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                includeHashtags ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-sm">Incluir sugestão de hashtags (10–15)</span>
        </label>

        <button
          onClick={generate}
          disabled={loading || !topic.trim()}
          className="brand-gradient flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando legendas…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Gerar 3 opções de legenda
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {options.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-medium">3 opções geradas</h2>
          <div className="grid gap-4">
            {options.map((opt, i) => (
              <div key={i} className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <CopyButton text={opt.text} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{opt.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}