import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/* ─── helpers ─────────────────────────────────────────────── */
const H   = 1080;
const W   = 1080;
const PAD = 52;   // padding lateral
const FOOTER_H = 88;

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const titulo      = sp.get("titulo")  ?? "";
  const corpo       = sp.get("corpo")   ?? "";
  const tag         = sp.get("tag")     ?? "SLIDE";
  const idx         = Number(sp.get("i")       ?? "0");
  const total       = Number(sp.get("t")       ?? "5");
  const imgUrl      = sp.get("img")     ?? "";
  const companyName = sp.get("company") ?? "";
  const brandColor  = sp.get("color")   ?? "#4F8CFF";

  const lines   = corpo.split("\n").map(l => l.trim()).filter(Boolean);
  const isCapa  = Boolean(imgUrl || companyName);

  /* ── footer (posição absoluta) ── */
  const Footer = () => (
    <div
      style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: FOOTER_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${PAD}px 20px`,
        borderTop: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* avatar + handle */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: 26,
            background: "linear-gradient(135deg,#4F8CFF,#7C5CFF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 19, fontWeight: 900,
          }}
        >LS</div>
        <span style={{ fontSize: 22, color: "rgba(255,255,255,0.38)", fontWeight: 700 }}>
          @luizsantos.ia
        </span>
      </div>

      {/* progress dots */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === idx ? 34 : 11,
              height: 11,
              borderRadius: 6,
              background: i === idx ? "#4F8CFF" : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>
    </div>
  );

  /* ─────────────────── CAPA ─────────────────── */
  if (isCapa) {
    const IMG_H   = 430;  // área da imagem / marca
    const TEXT_Y  = 9 + IMG_H + 24;  // posição vertical do bloco de texto
    const TEXT_H  = H - TEXT_Y - FOOTER_H - 16;

    return new ImageResponse(
      (
        <div
          style={{
            width: W, height: H,
            background: "#06060c",
            display: "flex", flexDirection: "column",
            position: "relative",
            fontFamily: "sans-serif",
          }}
        >
          {/* barra de acento */}
          <div style={{ height: 9, background: "linear-gradient(90deg,#4F8CFF,#a855f7,#4F8CFF)", display: "flex", flexShrink: 0 }} />

          {/* ── área da imagem / marca ── */}
          <div
            style={{
              position: "absolute",
              top: 9,
              left: PAD, right: PAD,
              height: IMG_H,
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: companyName
                ? "linear-gradient(135deg,#08080f 0%,#0f111a 55%,#080810 100%)"
                : "#111",
            }}
          >
            {companyName ? (
              /* nome da empresa em card branco */
              <div
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: "32px 80px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 60px rgba(0,0,0,0.7)",
                }}
              >
                <span
                  style={{
                    fontSize: 88,
                    fontWeight: 900,
                    color: brandColor,
                    letterSpacing: -3,
                    lineHeight: 1,
                  }}
                >
                  {companyName}
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl}
                width={W - PAD * 2}
                height={IMG_H}
                style={{ objectFit: "cover" }}
                alt=""
              />
            )}

            {/* badge CAPA */}
            <div
              style={{
                position: "absolute", top: 14, left: 14,
                background: "rgba(0,0,0,0.72)",
                borderRadius: 8, padding: "6px 14px",
                fontSize: 19, fontWeight: 900, letterSpacing: 2,
                color: "#fff", display: "flex",
              }}
            >{tag}</div>

            {/* contador */}
            <div
              style={{
                position: "absolute", top: 14, right: 14,
                background: "rgba(0,0,0,0.6)",
                borderRadius: 8, padding: "6px 12px",
                fontSize: 19, fontWeight: 700,
                color: "rgba(255,255,255,0.8)", display: "flex",
              }}
            >{idx + 1}/{total}</div>
          </div>

          {/* ── bloco de texto abaixo da imagem ── */}
          <div
            style={{
              position: "absolute",
              top: TEXT_Y,
              left: PAD, right: PAD,
              height: TEXT_H,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.15,
                letterSpacing: -1.5,
              }}
            >
              {titulo}
            </div>
            <div
              style={{
                fontSize: 26,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.5,
              }}
            >
              {lines[0] ?? ""}
            </div>
          </div>

          <Footer />
        </div>
      ),
      { width: W, height: H }
    );
  }

  /* ─────────────────── SLIDES 2-5 (texto) ─────────────────── */
  const HEADER_H = 80;   // tag + espaço
  const DIV_Y    = 9 + HEADER_H;
  const TEXT_TOP = DIV_Y + 24;
  const TEXT_H   = H - TEXT_TOP - FOOTER_H - 12;

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H,
          background: "#06060c",
          display: "flex", flexDirection: "column",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* barra de acento */}
        <div style={{ height: 9, background: "linear-gradient(90deg,#4F8CFF,#a855f7,#4F8CFF)", display: "flex", flexShrink: 0 }} />

        {/* cabeçalho: tag + contador */}
        <div
          style={{
            position: "absolute",
            top: 9, left: PAD, right: PAD,
            height: HEADER_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 900, color: "#4F8CFF", letterSpacing: 3 }}>
            {tag}
          </span>
          <span style={{ fontSize: 20, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>
            {idx + 1}/{total}
          </span>
        </div>

        {/* divisor */}
        <div
          style={{
            position: "absolute",
            top: DIV_Y, left: PAD, right: PAD,
            height: 2,
            background: "rgba(79,140,255,0.22)",
            display: "flex",
          }}
        />

        {/* conteúdo */}
        <div
          style={{
            position: "absolute",
            top: TEXT_TOP, left: PAD, right: PAD,
            height: TEXT_H,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflow: "hidden",
          }}
        >
          {/* título */}
          <div
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.15,
              letterSpacing: -1.5,
            }}
          >
            {titulo}
          </div>

          {/* corpo — limitado a 6 linhas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lines.slice(0, 6).map((line, i) => (
              <div
                key={i}
                style={{
                  fontSize: 28,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.55,
                  display: "flex",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        <Footer />
      </div>
    ),
    { width: W, height: H }
  );
}
