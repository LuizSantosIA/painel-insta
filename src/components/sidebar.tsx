"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Images, Sparkles, Plug, Camera,
  Clock, CalendarDays, Wand2, Bot, Zap,
  Users, TrendingUp, CheckSquare,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Empresa",
    items: [
      { href: "/clientes",  label: "Clientes",   icon: Users },
      { href: "/pipeline",  label: "Pipeline",   icon: TrendingUp },
      { href: "/tarefas",   label: "Tarefas",    icon: CheckSquare },
    ],
  },
  {
    label: "Instagram",
    items: [
      { href: "/",            label: "Visão geral",       icon: LayoutDashboard },
      { href: "/posts",       label: "Posts",             icon: Images },
      { href: "/recomendacoes", label: "Recomendações",   icon: Sparkles },
      { href: "/horarios",    label: "Melhores horários", icon: Clock },
      { href: "/calendario",  label: "Calendário",        icon: CalendarDays },
      { href: "/automacoes",  label: "Automações",        icon: Zap },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { href: "/gerador",    label: "Gerador de legenda", icon: Wand2 },
      { href: "/chat",       label: "Assistente IA",      icon: Bot },
      { href: "/integracao", label: "Integração",         icon: Plug },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex w-[220px] shrink-0 flex-col sticky top-0 h-screen"
      style={{
        background: "rgba(4, 8, 18, 0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRight: "1px solid rgba(30,45,74,0.7)",
        position: "relative",
      }}
    >
      {/* Top glow line */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent 0%, rgba(79,140,255,0.55) 50%, transparent 100%)",
        zIndex: 1,
      }} />

      {/* Side right separator glow */}
      <div style={{
        position: "absolute",
        top: "20%",
        bottom: "20%",
        right: 0,
        width: "1px",
        background: "linear-gradient(180deg, transparent 0%, rgba(79,140,255,0.18) 50%, transparent 100%)",
        zIndex: 1,
      }} />

      {/* Logo */}
      <div className="px-5 pt-7 pb-5" style={{ position: "relative", zIndex: 2 }}>
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #4F8CFF 0%, #7C5CFF 100%)",
              boxShadow: "0 4px 20px rgba(79,140,255,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
              animation: "pulse-ring 3s ease-in-out infinite",
            }}
          >
            <Camera className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight tracking-tight" style={{ color: "#f1f5ff" }}>
              Command Center
            </p>
            <p className="text-[10px] leading-tight mt-0.5 font-medium" style={{
              background: "linear-gradient(90deg, #4F8CFF, #00D4FF)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}>
              IA · PRO
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-5 px-3 overflow-y-auto py-2" style={{ position: "relative", zIndex: 2 }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {/* Section label */}
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <span
                className="text-[9px] font-bold tracking-[0.18em] uppercase"
                style={{ color: "rgba(79,140,255,0.4)" }}
              >
                {section.label}
              </span>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(79,140,255,0.15), transparent)" }} />
            </div>

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative flex items-center gap-2.5 rounded-[14px] px-3 py-2 transition-all duration-200"
                    style={
                      active
                        ? {
                            background: "linear-gradient(135deg, rgba(79,140,255,0.14) 0%, rgba(124,92,255,0.08) 100%)",
                            border: "1px solid rgba(79,140,255,0.22)",
                            boxShadow: "0 2px 12px rgba(79,140,255,0.1), inset 0 1px 0 rgba(255,255,255,0.03)",
                          }
                        : {
                            background: "transparent",
                            border: "1px solid transparent",
                          }
                    }
                  >
                    {/* Active left bar */}
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "3px",
                          height: "16px",
                          borderRadius: "0 3px 3px 0",
                          background: "linear-gradient(180deg, #4F8CFF, #7C5CFF)",
                          boxShadow: "0 0 10px rgba(79,140,255,0.7)",
                        }}
                      />
                    )}

                    {/* Icon container */}
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
                      style={
                        active
                          ? {
                              background: "linear-gradient(135deg, rgba(79,140,255,0.22) 0%, rgba(124,92,255,0.18) 100%)",
                              boxShadow: "0 0 8px rgba(79,140,255,0.3)",
                            }
                          : { background: "transparent" }
                      }
                    >
                      <Icon
                        className="h-[14px] w-[14px] transition-all duration-200"
                        style={{
                          color: active ? "#6BABFF" : "#3d5275",
                          filter: active ? "drop-shadow(0 0 4px rgba(79,140,255,0.6))" : "none",
                        }}
                      />
                    </span>

                    <span
                      className="text-[13px] font-medium transition-colors duration-200 truncate"
                      style={{ color: active ? "#dde8ff" : "#4d6585" }}
                    >
                      {item.label}
                    </span>

                    {/* Hover shimmer */}
                    {!active && (
                      <span
                        className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ background: "rgba(79,140,255,0.04)" }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto" style={{ position: "relative", zIndex: 2 }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 16,
            right: 16,
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(79,140,255,0.2), transparent)",
          }}
        />
        <div
          className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 cursor-default"
          style={{
            border: "1px solid rgba(30,45,74,0.5)",
            background: "rgba(15,23,42,0.5)",
          }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[13px] font-bold"
            style={{
              background: "linear-gradient(135deg, #4F8CFF 0%, #7C5CFF 100%)",
              boxShadow: "0 2px 10px rgba(79,140,255,0.35)",
            }}
          >
            L
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: "#e8f0ff" }}>
              Luiz Santos
            </p>
            <p className="text-[10px] truncate font-medium" style={{
              background: "linear-gradient(90deg, #4F8CFF, #00D4FF)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}>
              Conta Business · ATIVO
            </p>
          </div>
          {/* Status dot */}
          <div style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#22C55E",
            boxShadow: "0 0 8px rgba(34,197,94,0.7)",
            flexShrink: 0,
            marginLeft: "auto",
          }} />
        </div>
      </div>
    </aside>
  );
}
