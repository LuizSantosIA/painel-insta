import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const titulo = sp.get("titulo") ?? "";
  const corpo  = sp.get("corpo")  ?? "";
  const tag    = sp.get("tag")    ?? "SLIDE";
  const idx    = Number(sp.get("i") ?? "0");
  const total  = Number(sp.get("t") ?? "5");
  const imgUrl = sp.get("img")    ?? "";

  const lines = corpo.split("\n").map(l => l.trim()).filter(Boolean);
  const dots  = Array.from({ length: total }, (_, i) => i);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080, height: 1080,
          backgroundColor: "#000000",
          display: "flex", flexDirection: "column",
          fontFamily: "sans-serif",
        }}
      >
        {/* Linha de acento */}
        <div style={{ height: 9, background: "linear-gradient(90deg,#4F8CFF,#a855f7,#4F8CFF)", display: "flex" }} />

        {imgUrl ? (
          /* ── CAPA com imagem ── */
          <>
            <div style={{
              display: "flex", height: 456, margin: "18px 20px 0",
              position: "relative", flexShrink: 0,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                width={1040}
                height={456}
                style={{ objectFit: "cover", borderRadius: 14 }}
                alt=""
              />
              <div style={{
                position: "absolute", top: 14, left: 14,
                backgroundColor: "rgba(0,0,0,0.72)", color: "#ffffff",
                fontSize: 20, fontWeight: 900, letterSpacing: 2,
                padding: "7px 15px", borderRadius: 8, display: "flex",
              }}>{tag}</div>
              <div style={{
                position: "absolute", top: 14, right: 14,
                backgroundColor: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.8)",
                fontSize: 20, fontWeight: 700, padding: "7px 13px", borderRadius: 8, display: "flex",
              }}>{idx + 1}/{total}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: "18px 28px 0", gap: 12, flex: 1 }}>
              <div style={{ fontSize: 50, fontWeight: 900, color: "#ffffff", lineHeight: 1.18, letterSpacing: -1.5 }}>
                {titulo}
              </div>
              <div style={{ fontSize: 26, color: "rgba(255,255,255,0.52)", lineHeight: 1.52 }}>
                {lines[0] ?? ""}
              </div>
            </div>
          </>
        ) : (
          /* ── Slides 2-5 texto ── */
          <>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "28px 44px 0" }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: "#4F8CFF", letterSpacing: 3 }}>{tag}</span>
              <span style={{ fontSize: 22, color: "rgba(255,255,255,0.22)", fontWeight: 700 }}>{idx + 1}/{total}</span>
            </div>
            <div style={{ height: 2, margin: "16px 44px", backgroundColor: "rgba(79,140,255,0.22)", display: "flex" }} />
            <div style={{ display: "flex", flexDirection: "column", padding: "0 44px", gap: 18, flex: 1 }}>
              <div style={{ fontSize: 50, fontWeight: 900, color: "#ffffff", lineHeight: 1.18, letterSpacing: -1.5 }}>
                {titulo}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {lines.slice(0, 8).map((line, i) => (
                  <div
                    key={i}
                    style={{ fontSize: 27, color: "rgba(255,255,255,0.52)", lineHeight: 1.55, display: "flex" }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Rodapé */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 44px 28px", flexShrink: 0 }}>
          <div style={{ height: 2, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 20, display: "flex" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 30,
                background: "linear-gradient(135deg, #4F8CFF, #7C5CFF)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#ffffff", fontSize: 22, fontWeight: 900,
              }}>LS</div>
              <span style={{ fontSize: 25, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>@luizsantos.ia</span>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              {dots.map((i) => (
                <div
                  key={i}
                  style={{
                    width: i === idx ? 38 : 13, height: 13, borderRadius: 7,
                    backgroundColor: i === idx ? "#4F8CFF" : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
