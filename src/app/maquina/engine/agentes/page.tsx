"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, X } from "lucide-react";
import {
  ALTURA_TEIA,
  LABEL_TIPO_NO,
  LARGURA_TEIA,
  LIGACOES_TEIA,
  NOS_TEIA,
  vizinhos,
  type NoId,
  type NoTeia,
  type TipoNo,
} from "@/lib/engine/teia";

/**
 * A teia dos agentes. Cada nó é um agente (ou você, ou a memória); as linhas
 * cheias são o post andando, as tracejadas são informação alimentando alguém.
 * Arraste os nós como quiser — a posição fica salva neste navegador. Clique
 * para ver o que cada um faz e como andou hoje.
 */

interface Execucao {
  agente: string;
  status: string;
  criadoEm: string;
  duracaoMs: number;
  tokensIn: number;
  tokensOut: number;
  erro: string | null;
  post: string | null;
}

interface EstadoAgente {
  hoje: number;
  erros: number;
  ultima: Execucao | null;
}

const CHAVE_POSICOES = "engine-teia-posicoes-v1";
const RAIO = 38;

const COR_TIPO: Record<TipoNo, string> = {
  IA: "var(--brand)",
  CODIGO: "var(--muted)",
  PENDENTE: "var(--warning)",
  HUMANO: "var(--success)",
  MEMORIA: "var(--brand-2)",
};

function lerPosicoes(): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(CHAVE_POSICOES);
    return raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : null;
  } catch {
    return null;
  }
}

function guardarPosicoes(p: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(CHAVE_POSICOES, JSON.stringify(p));
  } catch {
    /* navegador sem storage: a teia continua funcionando, só não lembra */
  }
}

/** Curva suave entre dois nós, encostando na borda do círculo, não no centro. */
function caminho(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const x1 = a.x + ux * RAIO;
  const y1 = a.y + uy * RAIO;
  const x2 = b.x - ux * (RAIO + 6);
  const y2 = b.y - uy * (RAIO + 6);
  // desvio perpendicular proporcional à distância: linhas longas curvam mais
  const k = Math.min(0.18 * d, 60);
  const cx = (x1 + x2) / 2 - uy * k;
  const cy = (y1 + y2) / 2 + ux * k;
  return { d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, mx: (x1 + 2 * cx + x2) / 4, my: (y1 + 2 * cy + y2) / 4 };
}

export default function AgentesPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(NOS_TEIA.map((n) => [n.id, { x: n.x, y: n.y }]))
  );
  const [selecionado, setSelecionado] = useState<NoId | null>(null);
  const [hover, setHover] = useState<NoId | null>(null);
  const [estado, setEstado] = useState<Record<string, EstadoAgente>>({});
  const arrasto = useRef<{ id: NoId; dx: number; dy: number; moveu: boolean } | null>(null);

  // posições guardadas neste navegador
  useEffect(() => {
    const guardadas = lerPosicoes();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação do localStorage só depois de montar
    if (guardadas) setPos((atual) => ({ ...atual, ...guardadas }));
  }, []);

  // como cada agente andou hoje
  useEffect(() => {
    let ativo = true;
    fetch("/api/maquina/engine/avancado")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((j: { execucoes: Execucao[] }) => {
        if (!ativo) return;
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        const porAgente: Record<string, EstadoAgente> = {};
        for (const e of j.execucoes) {
          const s = (porAgente[e.agente] ??= { hoje: 0, erros: 0, ultima: null });
          if (!s.ultima) s.ultima = e;
          if (new Date(e.criadoEm) >= inicioDia) {
            s.hoje++;
            if (e.status === "ERRO") s.erros++;
          }
        }
        setEstado(porAgente);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  const paraSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }, []);

  function iniciarArrasto(e: React.PointerEvent<SVGGElement>, id: NoId) {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const m = paraSvg(e.clientX, e.clientY);
    arrasto.current = { id, dx: pos[id].x - m.x, dy: pos[id].y - m.y, moveu: false };
  }

  function mover(e: React.PointerEvent<SVGGElement>) {
    const a = arrasto.current;
    if (!a) return;
    const m = paraSvg(e.clientX, e.clientY);
    const x = Math.max(RAIO, Math.min(LARGURA_TEIA - RAIO, m.x + a.dx));
    const y = Math.max(RAIO, Math.min(ALTURA_TEIA - RAIO, m.y + a.dy));
    if (!a.moveu && Math.hypot(x - pos[a.id].x, y - pos[a.id].y) > 3) a.moveu = true;
    if (a.moveu) setPos((p) => ({ ...p, [a.id]: { x, y } }));
  }

  function soltar(e: React.PointerEvent<SVGGElement>) {
    const a = arrasto.current;
    if (!a) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    arrasto.current = null;
    if (a.moveu) {
      setPos((p) => {
        guardarPosicoes(p);
        return p;
      });
    } else {
      setSelecionado((s) => (s === a.id ? null : a.id));
    }
  }

  function reorganizar() {
    const inicial = Object.fromEntries(NOS_TEIA.map((n) => [n.id, { x: n.x, y: n.y }]));
    setPos(inicial);
    try {
      localStorage.removeItem(CHAVE_POSICOES);
    } catch {
      /* sem storage */
    }
  }

  const foco = selecionado ?? hover;
  const ligadas = useMemo(() => {
    if (!foco) return null;
    const v = vizinhos(foco);
    return new Set([...v.entram.map((l) => l.de), ...v.saem.map((l) => l.para), foco]);
  }, [foco]);

  const no = selecionado ? NOS_TEIA.find((n) => n.id === selecionado) ?? null : null;
  const btn =
    "inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface-2/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground-2 transition-all duration-150 hover:border-brand/35 hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50";

  return (
    <div className="max-w-6xl space-y-4">
      <Link href="/maquina/engine" className="group inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" /> Máquina
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">A teia dos agentes</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            11 agentes, você e a memória. Linha cheia é o post andando; tracejada é informação alimentando alguém. Arraste, clique para ver a função.
          </p>
        </div>
        <button className={btn} onClick={reorganizar} title="Volta para o desenho original">
          <RotateCcw className="h-3.5 w-3.5" /> Reorganizar
        </button>
      </header>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {(Object.keys(LABEL_TIPO_NO) as TipoNo[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="h-[8px] w-[8px] rounded-full" style={{ background: COR_TIPO[t] }} /> {LABEL_TIPO_NO[t]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[8px] w-[8px] rounded-full bg-[color:var(--danger)]" /> erro hoje
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface/40">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${LARGURA_TEIA} ${ALTURA_TEIA}`}
            className="block h-auto w-full select-none touch-none"
            style={{ minHeight: 320 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelecionado(null);
            }}
          >
            <defs>
              <marker id="seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
              <radialGradient id="brilho">
                <stop offset="0%" stopColor="white" stopOpacity="0.08" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* grade discreta de fundo */}
            <pattern id="grade" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--border)" />
            </pattern>
            <rect width={LARGURA_TEIA} height={ALTURA_TEIA} fill="url(#grade)" pointerEvents="none" />

            {/* ligações */}
            {LIGACOES_TEIA.map((l, i) => {
              const a = pos[l.de];
              const b = pos[l.para];
              const c = caminho(a, b);
              const emFoco = ligadas ? ligadas.has(l.de) && ligadas.has(l.para) && (l.de === foco || l.para === foco) : true;
              const opacidade = ligadas ? (emFoco ? 1 : 0.15) : l.tipo === "fluxo" ? 0.75 : 0.45;
              return (
                <g key={i} style={{ opacity: opacidade, transition: "opacity 150ms" }} pointerEvents="none">
                  <path
                    d={c.d}
                    fill="none"
                    stroke={l.tipo === "fluxo" ? "var(--brand)" : "var(--muted-2)"}
                    strokeWidth={l.tipo === "fluxo" ? 1.8 : 1.2}
                    strokeDasharray={l.tipo === "dados" ? "5 5" : undefined}
                    markerEnd="url(#seta)"
                    style={{ color: l.tipo === "fluxo" ? "var(--brand)" : "var(--muted-2)" }}
                  />
                  {l.label && ligadas && emFoco && (
                    <text x={c.mx} y={c.my - 5} textAnchor="middle" fontSize="10" fill="var(--muted)" className="pointer-events-none">
                      {l.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* nós */}
            {NOS_TEIA.map((n) => {
              const p = pos[n.id];
              const s = estado[n.id];
              const cor = COR_TIPO[n.tipo];
              const apagado = ligadas ? !ligadas.has(n.id) : false;
              const ativo = selecionado === n.id;
              const comErro = (s?.erros ?? 0) > 0;
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x} ${p.y})`}
                  style={{ opacity: apagado ? 0.3 : 1, transition: "opacity 150ms", cursor: "grab" }}
                  onPointerDown={(e) => iniciarArrasto(e, n.id)}
                  onPointerMove={mover}
                  onPointerUp={soltar}
                  onPointerCancel={soltar}
                  onPointerEnter={() => setHover(n.id)}
                  onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                >
                  {ativo && <circle r={RAIO + 14} fill="url(#brilho)" />}
                  <circle
                    r={RAIO}
                    fill="var(--surface-2)"
                    stroke={comErro ? "var(--danger)" : cor}
                    strokeWidth={ativo ? 2.5 : 1.5}
                    strokeDasharray={n.tipo === "PENDENTE" ? "4 3" : undefined}
                  />
                  <circle r={RAIO - 6} fill={cor} fillOpacity={ativo ? 0.22 : 0.1} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight={600} fill="var(--foreground)">
                    {n.label.split(" ").length > 1 ? (
                      <>
                        <tspan x="0" dy="-7">{n.label.split(" ")[0]}</tspan>
                        <tspan x="0" dy="14">{n.label.split(" ").slice(1).join(" ")}</tspan>
                      </>
                    ) : (
                      n.label
                    )}
                  </text>
                  {s && s.hoje > 0 && (
                    <g transform={`translate(${RAIO - 6} ${-RAIO + 6})`}>
                      <circle r="9" fill={comErro ? "var(--danger)" : "var(--success)"} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight={700} fill="white">
                        {s.hoje}
                      </text>
                    </g>
                  )}
                  <text y={RAIO + 15} textAnchor="middle" fontSize="10.5" fill="var(--muted)" className="pointer-events-none">
                    {n.papel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="rounded-[12px] border border-border-subtle bg-surface/40 p-4 text-[12px]">
          {!no ? (
            <div className="space-y-2 text-muted">
              <p className="font-medium text-foreground-2">Clique num agente</p>
              <p>Aparece aqui o que ele faz, de quem recebe, para quem entrega e como andou hoje.</p>
              <p className="text-[11px] text-muted-2">Arraste os nós para desenhar a teia do seu jeito. A posição fica guardada neste navegador.</p>
            </div>
          ) : (
            <Detalhe no={no} estado={estado[no.id]} fechar={() => setSelecionado(null)} irPara={setSelecionado} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Detalhe({ no, estado, fechar, irPara }: { no: NoTeia; estado?: EstadoAgente; fechar: () => void; irPara: (id: NoId) => void }) {
  const v = vizinhos(no.id);
  const nome = (id: NoId) => NOS_TEIA.find((n) => n.id === id)?.label ?? id;
  const semTrilha = no.tipo === "HUMANO" || no.tipo === "MEMORIA";
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.09em]" style={{ color: COR_TIPO[no.tipo] }}>
            {LABEL_TIPO_NO[no.tipo]}
          </p>
          <h2 className="text-[15px] font-semibold leading-tight text-foreground">{no.label}</h2>
          <p className="text-muted">{no.papel}</p>
        </div>
        <button onClick={fechar} className="text-muted hover:text-foreground" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="leading-relaxed text-foreground-2">{no.funcao}</p>

      <dl className="space-y-1.5">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.09em] text-muted-2">recebe</dt>
          <dd className="text-muted">{no.recebe}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.09em] text-muted-2">entrega</dt>
          <dd className="text-muted">{no.entrega}</dd>
        </div>
        {no.regra && (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.09em] text-muted-2">regra</dt>
            <dd className="text-[color:var(--warning)]">{no.regra}</dd>
          </div>
        )}
      </dl>

      <div className="space-y-1 border-t border-border-subtle pt-3">
        <p className="text-[10px] uppercase tracking-[0.09em] text-muted-2">ligações</p>
        {v.entram.map((l) => (
          <button key={`in-${l.de}`} onClick={() => irPara(l.de)} className="block text-left text-muted hover:text-foreground">
            ← {nome(l.de)} <span className="text-muted-2">· {l.label}</span>
          </button>
        ))}
        {v.saem.map((l) => (
          <button key={`out-${l.para}`} onClick={() => irPara(l.para)} className="block text-left text-muted hover:text-foreground">
            → {nome(l.para)} <span className="text-muted-2">· {l.label}</span>
          </button>
        ))}
      </div>

      {!semTrilha && (
        <div className="space-y-1 border-t border-border-subtle pt-3">
          <p className="text-[10px] uppercase tracking-[0.09em] text-muted-2">hoje</p>
          {no.tipo === "PENDENTE" ? (
            <p className="text-muted">Ainda não roda.</p>
          ) : !estado ? (
            <p className="text-muted">Nunca rodou.</p>
          ) : (
            <>
              <p className="text-foreground-2">
                {estado.hoje} {estado.hoje === 1 ? "execução" : "execuções"}
                {estado.erros > 0 && <span className="text-[color:var(--danger)]"> · {estado.erros} com erro</span>}
              </p>
              {estado.ultima && (
                <p className="text-[11px] text-muted-2">
                  última: {new Date(estado.ultima.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {estado.ultima.post && ` · ${estado.ultima.post}`}
                  {" · "}
                  {(estado.ultima.duracaoMs / 1000).toFixed(1)}s · {estado.ultima.tokensIn + estado.ultima.tokensOut}t
                  {estado.ultima.erro && <span className="text-[color:var(--danger)]"> · {estado.ultima.erro}</span>}
                </p>
              )}
            </>
          )}
          <Link href="/maquina/engine/avancado" className="inline-block text-[11px] text-muted hover:text-foreground">
            Ver execuções e prompts →
          </Link>
        </div>
      )}
    </div>
  );
}
