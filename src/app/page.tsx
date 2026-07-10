import Link from "next/link";
import { Sun, Briefcase, Cpu } from "lucide-react";

export default function HojePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Hoje</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          O que exige sua atenção agora
        </p>
      </header>

      <div
        className="card flex flex-col items-center justify-center gap-4 py-20 text-center"
        style={{ border: "1px solid rgba(79,140,255,0.15)" }}
      >
        <Sun className="h-10 w-10" style={{ color: "rgba(79,140,255,0.4)" }} />
        <div>
          <p className="font-semibold">Em construção — Fase 6</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Esta tela será preenchida com dados reais após as fases 1–5 estarem ativas.
          </p>
        </div>
        <div className="flex gap-3 mt-2">
          <Link href="/negocio" className="btn-secondary text-sm">
            <Briefcase className="h-4 w-4" /> Ver Negócio
          </Link>
          <Link href="/maquina/instagram" className="btn-secondary text-sm">
            <Cpu className="h-4 w-4" /> Ver Máquina
          </Link>
        </div>
      </div>
    </div>
  );
}
