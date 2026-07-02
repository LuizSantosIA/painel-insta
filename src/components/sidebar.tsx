"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Images,
  Sparkles,
  Plug,
  Camera,
  Clock,
  CalendarDays,
  Wand2,
  Bot,
  Zap,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: Images },
  { href: "/recomendacoes", label: "Recomendações", icon: Sparkles },
  { href: "/horarios", label: "Melhores horários", icon: Clock },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/gerador", label: "Gerador de legenda", icon: Wand2 },
  { href: "/chat", label: "Assistente IA", icon: Bot },
  { href: "/automacoes", label: "Automações", icon: Zap },
  { href: "/integracao", label: "Integração", icon: Plug },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface/40 px-4 py-6 hidden md:flex flex-col gap-8 sticky top-0 h-screen">
      <div className="flex items-center gap-3 px-2">
        <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl">
          <Camera className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold leading-tight">Painel IG</p>
          <p className="text-xs text-muted">Gestão de conteúdo</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:text-foreground hover:bg-surface-2/60"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 text-xs text-muted">
        <p>Feito para crescer no algoritmo 🚀</p>
      </div>
    </aside>
  );
}