"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, Briefcase, Cpu,
  Users, TrendingUp, CheckSquare, DollarSign, Activity, Flag,
  LayoutDashboard, Images, Sparkles, Plug,
  Clock, CalendarDays, Wand2, Bot, Zap, Camera,
} from "lucide-react";

type SubItem = { href: string; label: string; icon: React.ElementType };
type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  sub: SubItem[];
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Hoje",
    icon: Sun,
    exact: true,
    sub: [],
  },
  {
    href: "/negocio",
    label: "Negócio",
    icon: Briefcase,
    sub: [
      { href: "/negocio/clientes",   label: "Clientes",   icon: Users },
      { href: "/negocio/pipeline",   label: "Pipeline",   icon: TrendingUp },
      { href: "/negocio/saude",          label: "Saúde",         icon: Activity },
      { href: "/negocio/compromissos",   label: "Compromissos",  icon: Flag },
      { href: "/negocio/tarefas",        label: "Tarefas",       icon: CheckSquare },
      { href: "/negocio/financeiro", label: "Financeiro", icon: DollarSign },
    ],
  },
  {
    href: "/maquina",
    label: "Máquina",
    icon: Cpu,
    sub: [
      { href: "/maquina/instagram",    label: "Instagram",         icon: LayoutDashboard },
      { href: "/maquina/posts",        label: "Posts",             icon: Images },
      { href: "/maquina/recomendacoes",label: "Recomendações",     icon: Sparkles },
      { href: "/maquina/horarios",     label: "Melhores horários", icon: Clock },
      { href: "/maquina/calendario",   label: "Calendário",        icon: CalendarDays },
      { href: "/maquina/automacoes",   label: "Automações",        icon: Zap },
      { href: "/maquina/gerador",      label: "Gerador",           icon: Wand2 },
      { href: "/maquina/chat",         label: "Assistente IA",     icon: Bot },
      { href: "/maquina/integracao",   label: "Integração",        icon: Plug },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  function isSubActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

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
        top: 0, left: 0, right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(79,140,255,0.55), transparent)",
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
      <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto py-2" style={{ position: "relative", zIndex: 2 }}>
        {NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const hasSub = item.sub.length > 0;

          return (
            <div key={item.href}>
              {/* Primary item */}
              <Link
                href={item.href}
                className="group relative flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 transition-all duration-200 mb-0.5"
                style={
                  active
                    ? {
                        background: "linear-gradient(135deg, rgba(79,140,255,0.16) 0%, rgba(124,92,255,0.1) 100%)",
                        border: "1px solid rgba(79,140,255,0.24)",
                        boxShadow: "0 2px 12px rgba(79,140,255,0.12), inset 0 1px 0 rgba(255,255,255,0.03)",
                      }
                    : {
                        background: "transparent",
                        border: "1px solid transparent",
                      }
                }
              >
                {active && (
                  <span style={{
                    position: "absolute",
                    left: 0, top: "50%",
                    transform: "translateY(-50%)",
                    width: "3px", height: "18px",
                    borderRadius: "0 3px 3px 0",
                    background: "linear-gradient(180deg, #4F8CFF, #7C5CFF)",
                    boxShadow: "0 0 10px rgba(79,140,255,0.7)",
                  }} />
                )}

                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
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
                    className="h-[15px] w-[15px] transition-all duration-200"
                    style={{
                      color: active ? "#6BABFF" : "#3d5275",
                      filter: active ? "drop-shadow(0 0 4px rgba(79,140,255,0.6))" : "none",
                    }}
                  />
                </span>

                <span
                  className="text-[13px] font-semibold transition-colors duration-200 truncate"
                  style={{ color: active ? "#dde8ff" : "#5d7899" }}
                >
                  {item.label}
                </span>

                {!active && (
                  <span
                    className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ background: "rgba(79,140,255,0.04)" }}
                  />
                )}
              </Link>

              {/* Sub-items — show when section is active */}
              {hasSub && active && (
                <div className="flex flex-col gap-0.5 mb-1 pl-3">
                  {item.sub.map((sub) => {
                    const subActive = isSubActive(sub.href);
                    const SubIcon = sub.icon;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className="group relative flex items-center gap-2 rounded-[12px] px-2.5 py-1.5 transition-all duration-150"
                        style={
                          subActive
                            ? {
                                background: "rgba(79,140,255,0.1)",
                                border: "1px solid rgba(79,140,255,0.18)",
                              }
                            : {
                                background: "transparent",
                                border: "1px solid transparent",
                              }
                        }
                      >
                        <SubIcon
                          className="h-[13px] w-[13px] shrink-0"
                          style={{ color: subActive ? "#6BABFF" : "#3d5275" }}
                        />
                        <span
                          className="text-[12px] font-medium truncate"
                          style={{ color: subActive ? "#c8d8ff" : "#4d6585" }}
                        >
                          {sub.label}
                        </span>
                        {!subActive && (
                          <span className="absolute inset-0 rounded-[12px] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            style={{ background: "rgba(79,140,255,0.04)" }} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto" style={{ position: "relative", zIndex: 2 }}>
        <div style={{
          position: "absolute",
          top: 0, left: 16, right: 16,
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(79,140,255,0.2), transparent)",
        }} />
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
          <div style={{
            width: 7, height: 7,
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
