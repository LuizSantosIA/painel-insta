"use client";

import { useEffect, useState } from "react";

let _shown = false;

export function WelcomeScreen() {
  const [phase, setPhase] = useState<"active" | "exiting" | "done">(_shown ? "done" : "active");

  useEffect(() => {
    if (_shown) return;
    _shown = true;

    const t1 = setTimeout(() => setPhase("exiting"), 2700);
    const t2 = setTimeout(() => setPhase("done"), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "done") return null;

  return (
    <>
      <style>{`
        @keyframes ws-grid-drift {
          from { background-position: 0 0; }
          to   { background-position: 60px 60px; }
        }
        @keyframes ws-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ws-letter {
          from { opacity: 0; transform: translateY(32px) scale(0.88); filter: blur(8px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes ws-line-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes ws-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes ws-scanline {
          from { top: -4px; }
          to   { top: 100vh; }
        }
        @keyframes ws-ambient {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.06); }
        }
        @keyframes ws-corner {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#020916",
          backgroundImage: [
            "linear-gradient(rgba(79,140,255,0.055) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(79,140,255,0.055) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "60px 60px",
          animation: "ws-grid-drift 10s linear infinite",
          opacity: phase === "exiting" ? 0 : 1,
          transition: "opacity 500ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Scanline */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "3px",
            background: "linear-gradient(90deg, transparent 0%, rgba(79,140,255,0.25) 50%, transparent 100%)",
            animation: "ws-scanline 3.5s linear infinite",
          }} />
        </div>

        {/* Ambient glow */}
        <div style={{
          position: "absolute",
          width: "900px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(79,140,255,0.12) 0%, rgba(124,92,255,0.06) 40%, transparent 70%)",
          pointerEvents: "none",
          animation: "ws-ambient 4s ease-in-out infinite",
        }} />

        {/* Content wrapper */}
        <div style={{ position: "relative", textAlign: "center", padding: "48px 56px" }}>

          {/* HUD corners */}
          <div style={{ position:"absolute", top:0, left:0, width:28, height:28, borderTop:"2px solid rgba(79,140,255,0.55)", borderLeft:"2px solid rgba(79,140,255,0.55)", animation:"ws-corner 0.4s ease 100ms both" }} />
          <div style={{ position:"absolute", top:0, right:0, width:28, height:28, borderTop:"2px solid rgba(79,140,255,0.55)", borderRight:"2px solid rgba(79,140,255,0.55)", animation:"ws-corner 0.4s ease 200ms both" }} />
          <div style={{ position:"absolute", bottom:0, left:0, width:28, height:28, borderBottom:"2px solid rgba(79,140,255,0.55)", borderLeft:"2px solid rgba(79,140,255,0.55)", animation:"ws-corner 0.4s ease 300ms both" }} />
          <div style={{ position:"absolute", bottom:0, right:0, width:28, height:28, borderBottom:"2px solid rgba(79,140,255,0.55)", borderRight:"2px solid rgba(79,140,255,0.55)", animation:"ws-corner 0.4s ease 400ms both" }} />

          {/* System tag */}
          <p style={{
            fontSize: "10px",
            letterSpacing: "0.5em",
            textTransform: "uppercase",
            color: "rgba(79,140,255,0.55)",
            marginBottom: "22px",
            fontFamily: "monospace",
            animation: "ws-fade-up 0.5s ease 150ms both",
          }}>
            SISTEMA ATIVO · COMMAND CENTER
          </p>

          {/* BEM-VINDO */}
          <p style={{
            fontSize: "15px",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "rgba(200,212,240,0.85)",
            marginBottom: "10px",
            animation: "ws-fade-up 0.5s ease 350ms both",
          }}>
            BEM-VINDO
          </p>

          {/* Divider */}
          <div style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(79,140,255,0.45), transparent)",
            marginBottom: "26px",
            transformOrigin: "center",
            animation: "ws-line-grow 0.7s ease 500ms both",
          }} />

          {/* CHEFE */}
          <div style={{ display: "flex", justifyContent: "center", gap: "2px" }}>
            {"CHEFE".split("").map((char, i) => (
              <span
                key={i}
                style={{
                  fontSize: "clamp(72px, 13vw, 120px)",
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  background: "linear-gradient(155deg, #93BBFF 0%, #4F8CFF 30%, #A78BFF 65%, #00D4FF 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  display: "inline-block",
                  filter: "drop-shadow(0 0 28px rgba(79,140,255,0.45))",
                  animation: `ws-letter 0.65s cubic-bezier(0.34,1.56,0.64,1) ${600 + i * 75}ms both`,
                }}
              >
                {char}
              </span>
            ))}
          </div>

          {/* Subtitle */}
          <p style={{
            fontSize: "11px",
            letterSpacing: "0.28em",
            color: "rgba(107,130,168,0.65)",
            marginTop: "26px",
            textTransform: "uppercase",
            fontFamily: "monospace",
            animation: "ws-fade-up 0.5s ease 1200ms both",
          }}>
            INICIALIZANDO SISTEMAS
          </p>

          {/* Progress bar */}
          <div style={{ marginTop: "28px" }}>
            <div style={{
              width: "260px",
              height: "2px",
              background: "rgba(79,140,255,0.1)",
              borderRadius: "100px",
              overflow: "hidden",
              margin: "0 auto",
            }}>
              <div style={{
                height: "100%",
                borderRadius: "100px",
                background: "linear-gradient(90deg, #4F8CFF, #7C5CFF, #00D4FF)",
                boxShadow: "0 0 14px rgba(79,140,255,0.8)",
                animation: "ws-progress 2s cubic-bezier(0.4,0,0.2,1) 800ms both",
              }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
