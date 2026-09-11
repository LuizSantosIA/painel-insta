import "server-only";
import { ImageResponse } from "next/og";

/**
 * Renderização de slide: o sistema visual é um template de código.
 *
 * É a metade "determinística" do híbrido: tipografia, paleta e grid vêm daqui,
 * então os 7 slides saem idênticos em identidade e o texto em português sai
 * perfeito. O elemento ilustrativo (quando o estilo usa asset) entra por URL.
 *
 * Satori só suporta flexbox — nada de grid CSS aqui.
 */

export const LARGURA = 1080;
export const ALTURA = 1350;

export interface SlideRender {
  ordem: number;
  total: number;
  headline: string;
  corpo: string;
  microcopy: string;
  layout: string;
  assetUrl: string | null;
}

export interface EstiloRender {
  chave: string;
  paleta: { fundo: string; texto: string; destaque: string; secundaria: string };
  usaAsset: boolean;
}

export function parsePaleta(json: string): EstiloRender["paleta"] {
  try {
    const p = JSON.parse(json);
    return {
      fundo: p.fundo ?? "#FFFFFF",
      texto: p.texto ?? "#111111",
      destaque: p.destaque ?? "#FF5A1F",
      secundaria: p.secundaria ?? "#777777",
    };
  } catch {
    return { fundo: "#FFFFFF", texto: "#111111", destaque: "#FF5A1F", secundaria: "#777777" };
  }
}

/** Divide o corpo em itens quando o layout é LISTA. Aceita quebras de linha ou ponto-e-vírgula. */
function itensDaLista(corpo: string): string[] {
  const partes = corpo.split(/\n|;/).map((s) => s.replace(/^[-•\d.)\s]+/, "").trim()).filter(Boolean);
  return partes.length > 1 ? partes : [corpo];
}

function tamanhoHeadline(texto: string, base: number): number {
  const n = texto.length;
  if (n <= 24) return base;
  if (n <= 40) return Math.round(base * 0.82);
  if (n <= 60) return Math.round(base * 0.66);
  return Math.round(base * 0.55);
}

// ─── Peças comuns ────────────────────────────────────────────────────────────

function Rodape({ s, e, mono }: { s: SlideRender; e: EstiloRender; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        fontSize: 26,
        color: e.paleta.secundaria,
        letterSpacing: mono ? 2 : 1,
        fontFamily: mono ? "monospace" : undefined,
      }}
    >
      <span>@luizsantos.ia</span>
      <span>
        {String(s.ordem).padStart(2, "0")} / {String(s.total).padStart(2, "0")}
      </span>
    </div>
  );
}

function Micro({ texto, cor }: { texto: string; cor: string }) {
  if (!texto) return null;
  return (
    <div style={{ display: "flex", fontSize: 28, color: cor, letterSpacing: 3, textTransform: "uppercase" }}>
      {texto}
    </div>
  );
}

// ─── Templates ───────────────────────────────────────────────────────────────

function EditorialOrange({ s, e }: { s: SlideRender; e: EstiloRender }) {
  const { paleta } = e;
  const hook = s.layout === "HOOK";
  const cta = s.layout === "CTA";
  return (
    <div
      style={{
        width: LARGURA,
        height: ALTURA,
        display: "flex",
        flexDirection: "column",
        background: paleta.fundo,
        color: paleta.texto,
        padding: 72,
        position: "relative",
      }}
    >
      {/* marcadores técnicos */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, letterSpacing: 4, color: paleta.secundaria }}>
        <span>LUIZSANTOS.IA</span>
        <span>{s.layout} · {String(s.ordem).padStart(2, "0")}</span>
      </div>
      <div style={{ display: "flex", height: 6, width: 160, background: paleta.destaque, marginTop: 28 }} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: hook ? "center" : "flex-start", paddingTop: hook ? 0 : 80 }}>
        <div
          style={{
            display: "flex",
            fontSize: tamanhoHeadline(s.headline, hook ? 132 : 96),
            fontWeight: 900,
            lineHeight: 0.98,
            letterSpacing: -3,
            textTransform: "uppercase",
            color: cta ? paleta.destaque : paleta.texto,
          }}
        >
          {s.headline}
        </div>

        {!hook && s.corpo && s.layout !== "LISTA" && (
          <div style={{ display: "flex", fontSize: 40, lineHeight: 1.3, marginTop: 44, color: paleta.texto, maxWidth: 900 }}>
            {s.corpo}
          </div>
        )}

        {s.layout === "LISTA" && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
            {itensDaLista(s.corpo).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", fontSize: 38, lineHeight: 1.25, marginBottom: 22 }}>
                <span style={{ color: paleta.destaque, fontWeight: 900, marginRight: 22, minWidth: 64 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ display: "flex", flex: 1 }}>{item}</span>
              </div>
            ))}
          </div>
        )}

        {s.layout === "DESTAQUE" && s.corpo && (
          <div style={{ display: "flex", fontSize: 44, marginTop: 44, padding: "28px 36px", background: paleta.texto, color: paleta.fundo, alignSelf: "flex-start" }}>
            {s.corpo}
          </div>
        )}

        <div style={{ display: "flex", marginTop: 36 }}>
          <Micro texto={s.microcopy} cor={paleta.destaque} />
        </div>
      </div>

      <Rodape s={s} e={e} />
    </div>
  );
}

function BlueTech({ s, e }: { s: SlideRender; e: EstiloRender }) {
  const { paleta } = e;
  const hook = s.layout === "HOOK";
  return (
    <div
      style={{
        width: LARGURA,
        height: ALTURA,
        display: "flex",
        flexDirection: "column",
        background: paleta.fundo,
        backgroundImage: `linear-gradient(${paleta.secundaria}22 1px, transparent 1px), linear-gradient(90deg, ${paleta.secundaria}22 1px, transparent 1px)`,
        backgroundSize: "54px 54px",
        color: paleta.texto,
        padding: 64,
      }}
    >
      <div style={{ display: "flex", fontFamily: "monospace", fontSize: 24, color: paleta.destaque, letterSpacing: 2 }}>
        ~/luizsantos.ia $ slide --{String(s.ordem).padStart(2, "0")}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          marginTop: 40,
          padding: 56,
          background: "#FFFFFF",
          border: `3px solid ${paleta.destaque}`,
          borderRadius: 24,
          justifyContent: hook ? "center" : "flex-start",
        }}
      >
        <div style={{ display: "flex", fontSize: tamanhoHeadline(s.headline, hook ? 112 : 84), fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
          {s.headline}
        </div>

        {!hook && s.corpo && s.layout !== "LISTA" && (
          <div style={{ display: "flex", fontSize: 38, lineHeight: 1.35, marginTop: 40, color: paleta.texto }}>{s.corpo}</div>
        )}

        {s.layout === "LISTA" && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            {itensDaLista(s.corpo).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", fontSize: 36, marginBottom: 20, padding: "18px 24px", background: `${paleta.destaque}12`, borderRadius: 14 }}>
                <span style={{ fontFamily: "monospace", color: paleta.destaque, marginRight: 20 }}>{`>`}</span>
                <span style={{ display: "flex", flex: 1 }}>{item}</span>
              </div>
            ))}
          </div>
        )}

        {s.layout === "DESTAQUE" && s.corpo && (
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 40, marginTop: 40, padding: "24px 32px", background: paleta.texto, color: "#8AF0B0", borderRadius: 14, alignSelf: "flex-start" }}>
            {s.corpo}
          </div>
        )}

        <div style={{ display: "flex", marginTop: 32 }}>
          <Micro texto={s.microcopy} cor={paleta.secundaria} />
        </div>
      </div>

      <div style={{ display: "flex", marginTop: 32 }}>
        <Rodape s={s} e={e} mono />
      </div>
    </div>
  );
}

function MinimalEditorial({ s, e }: { s: SlideRender; e: EstiloRender }) {
  const { paleta } = e;
  const hook = s.layout === "HOOK";
  return (
    <div style={{ width: LARGURA, height: ALTURA, display: "flex", flexDirection: "column", background: paleta.fundo, color: paleta.texto, padding: 110 }}>
      <div style={{ display: "flex", width: 44, height: 44, borderRadius: 22, background: paleta.destaque }} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: tamanhoHeadline(s.headline, hook ? 104 : 80), fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, fontFamily: "serif" }}>
          {s.headline}
        </div>

        {!hook && s.corpo && s.layout !== "LISTA" && (
          <div style={{ display: "flex", fontSize: 36, lineHeight: 1.45, marginTop: 48, color: paleta.secundaria, maxWidth: 780 }}>{s.corpo}</div>
        )}

        {s.layout === "LISTA" && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
            {itensDaLista(s.corpo).map((item, i) => (
              <div key={i} style={{ display: "flex", fontSize: 34, lineHeight: 1.4, marginBottom: 18, color: paleta.texto }}>
                <span style={{ color: paleta.destaque, marginRight: 18 }}>—</span>
                <span style={{ display: "flex", flex: 1 }}>{item}</span>
              </div>
            ))}
          </div>
        )}

        {s.layout === "DESTAQUE" && s.corpo && (
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, marginTop: 48, color: paleta.destaque, fontFamily: "serif" }}>{s.corpo}</div>
        )}

        <div style={{ display: "flex", marginTop: 40 }}>
          <Micro texto={s.microcopy} cor={paleta.secundaria} />
        </div>
      </div>

      <Rodape s={s} e={e} />
    </div>
  );
}

function VoxelTech({ s, e }: { s: SlideRender; e: EstiloRender }) {
  const { paleta } = e;
  return (
    <div style={{ width: LARGURA, height: ALTURA, display: "flex", flexDirection: "column", background: paleta.fundo, color: paleta.texto, padding: 64 }}>
      <div style={{ display: "flex", fontFamily: "monospace", fontSize: 24, color: paleta.secundaria, letterSpacing: 2 }}>
        [{String(s.ordem).padStart(2, "0")}] {s.layout}
      </div>

      {/* protagonista visual: o asset gerado, ou a moldura reservada para ele */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 520,
          marginTop: 32,
          borderRadius: 20,
          border: `2px dashed ${paleta.secundaria}66`,
          background: `${paleta.destaque}0D`,
          overflow: "hidden",
        }}
      >
        {s.assetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.assetUrl} alt="" width={1080 - 128} height={520} style={{ objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: "monospace", fontSize: 26, color: paleta.secundaria }}>asset pendente</span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 44 }}>
        <div style={{ display: "flex", fontSize: tamanhoHeadline(s.headline, 72), fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>{s.headline}</div>
        {s.corpo && (
          <div style={{ display: "flex", fontSize: 34, lineHeight: 1.35, marginTop: 28, color: paleta.secundaria }}>{s.corpo}</div>
        )}
        <div style={{ display: "flex", marginTop: 24 }}>
          <Micro texto={s.microcopy} cor={paleta.destaque} />
        </div>
      </div>

      <Rodape s={s} e={e} mono />
    </div>
  );
}

const TEMPLATES: Record<string, (p: { s: SlideRender; e: EstiloRender }) => React.ReactElement> = {
  EDITORIAL_ORANGE: EditorialOrange,
  BLUE_TECH: BlueTech,
  MINIMAL_EDITORIAL: MinimalEditorial,
  VOXEL_TECH: VoxelTech,
};

/** Renderiza um slide como PNG. Estilo desconhecido cai no editorial. */
export async function renderizarSlide(s: SlideRender, e: EstiloRender): Promise<Buffer> {
  const Template = TEMPLATES[e.chave] ?? EditorialOrange;
  const resposta = new ImageResponse(<Template s={s} e={e} />, { width: LARGURA, height: ALTURA });
  return Buffer.from(await resposta.arrayBuffer());
}
