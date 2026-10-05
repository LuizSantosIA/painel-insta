"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, Briefcase, Cpu,
  Users, TrendingUp, CheckSquare, DollarSign, Activity, Flag, Gauge,
  LayoutDashboard, Images, Plug, Sparkles, MessagesSquare,
  CalendarDays, Zap, Camera, MessageCircle,
} from "lucide-react";

type SubItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Rótulo da seção. Repetido em itens seguidos, só o primeiro renderiza o título. */
  grupo?: string;
  /** Para o item que aponta para a raiz da seção e não deve casar com as subrotas. */
  exact?: boolean;
};
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
    href: "/assistente",
    label: "Assistente",
    icon: MessagesSquare,
    exact: true,
    sub: [],
  },
  {
    href: "/negocio",
    label: "Negócio",
    icon: Briefcase,
    sub: [
      { href: "/negocio",              label: "Visão geral",  icon: Gauge,       exact: true },
      { href: "/negocio/clientes",     label: "Clientes",     icon: Users,       grupo: "Relacionamento" },
      { href: "/negocio/pipeline",     label: "Pipeline",     icon: TrendingUp,  grupo: "Relacionamento" },
      { href: "/negocio/saude",        label: "Saúde",        icon: Activity,    grupo: "Relacionamento" },
      { href: "/negocio/compromissos", label: "Compromissos", icon: Flag,        grupo: "Operação" },
      { href: "/negocio/tarefas",      label: "Tarefas",      icon: CheckSquare, grupo: "Operação" },
      { href: "/negocio/financeiro",   label: "Financeiro",   icon: DollarSign,  grupo: "Finanças" },
    ],
  },
  {
    href: "/maquina",
    label: "Máquina",
    icon: Cpu,
    sub: [
      { href: "/maquina/visao-geral",  label: "Visão geral",  icon: Gauge },
      { href: "/maquina/engine",       label: "Máquina de conteúdo", icon: Sparkles, grupo: "Aquisição" },
      { href: "/maquina/conteudo",     label: "Conteúdo",     icon: Images,        grupo: "Aquisição" },
      { href: "/maquina/calendario",   label: "Calendário",   icon: CalendarDays,  grupo: "Aquisição" },
      { href: "/maquina/conversas",    label: "Conversas",    icon: MessageCircle, grupo: "Aquisição" },
      { href: "/maquina/automacoes",   label: "Automações",   icon: Zap,           grupo: "Aquisição" },
      { href: "/maquina/instagram",    label: "Audiência",    icon: LayoutDashboard, grupo: "Análise" },
      { href: "/maquina/integracoes",  label: "Integrações",  icon: Plug,          grupo: "Configuração" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  function isSubActive(sub: SubItem) {
    if (sub.exact) return pathname === sub.href;
    return pathname === sub.href || pathname.startsWith(sub.href + "/");
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
                className="group relative mb-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <Icon
                    className="h-[15px] w-[15px] transition-colors duration-150"
                    style={{ color: active ? "#6BABFF" : "#546d92" }}
                  />
                </span>

                <span
                  className="truncate text-[13px] font-semibold tracking-tight transition-colors duration-150"
                  style={{ color: active ? "#e2ebff" : "#7d94b8" }}
                >
                  {item.label}
                </span>

                <span
                  className="absolute inset-0 rounded-[10px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ background: "rgba(79,140,255,0.05)" }}
                />
              </Link>

              {/* Sub-items — show when section is active */}
              {hasSub && active && (
                <div className="flex flex-col gap-0.5 mb-1 pl-3">
                  {item.sub.map((sub, i) => {
                    const subActive = isSubActive(sub);
                    const SubIcon = sub.icon;
                    const abreGrupo = sub.grupo && sub.grupo !== item.sub[i - 1]?.grupo;
                    return (
                      <div key={sub.href}>
                      {abreGrupo && (
                        <p
                          className="px-2.5 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.13em]"
                          style={{ color: "#5f769c" }}
                        >
                          {sub.grupo}
                        </p>
                      )}
                      <Link
                        href={sub.href}
                        aria-current={subActive ? "page" : undefined}
                        className="group relative flex items-center gap-2 rounded-[9px] px-2.5 py-[5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
                        style={
                          subActive
                            ? {
                                background: "rgba(79,140,255,0.13)",
                                border: "1px solid rgba(79,140,255,0.22)",
                              }
                            : {
                                background: "transparent",
                                border: "1px solid transparent",
                              }
                        }
                      >
                        {subActive && (
                          <span
                            style={{
                              position: "absolute",
                              left: -9,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: 2,
                              height: 14,
                              borderRadius: "0 2px 2px 0",
                              background: "#4F8CFF",
                            }}
                          />
                        )}
                        <SubIcon
                          className="h-[13px] w-[13px] shrink-0 transition-colors duration-150"
                          style={{ color: subActive ? "#7CB4FF" : "#546d92" }}
                        />
                        <span
                          className="truncate text-[12px] font-medium transition-colors duration-150"
                          style={{ color: subActive ? "#dce8ff" : "#8299bd" }}
                        >
                          {sub.label}
                        </span>
                        {!subActive && (
                          <span className="absolute inset-0 rounded-[9px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                            style={{ background: "rgba(79,140,255,0.05)" }} />
                        )}
                      </Link>
                      </div>
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
        <div className="flex cursor-default items-center gap-2.5 rounded-[9px] px-2 py-1.5">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #4F8CFF 0%, #7C5CFF 100%)" }}
          >
            L
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium leading-tight" style={{ color: "#c9d8f5" }}>
              Luiz Santos
            </p>
            <p className="truncate text-[10px] leading-tight" style={{ color: "#6b81a8" }}>
              Conta Business
            </p>
          </div>
          <span
            title="Ativo"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22C55E",
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </aside>
  );
}
