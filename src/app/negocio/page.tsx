import Link from "next/link";
import { Users, TrendingUp, CheckSquare, DollarSign } from "lucide-react";

const SECTIONS = [
  {
    href: "/negocio/clientes",
    label: "Clientes",
    description: "CRM — base de clientes ativos e histórico",
    icon: Users,
    color: "#4F8CFF",
  },
  {
    href: "/negocio/pipeline",
    label: "Pipeline",
    description: "Negócios em andamento por estágio",
    icon: TrendingUp,
    color: "#7C5CFF",
  },
  {
    href: "/negocio/tarefas",
    label: "Tarefas",
    description: "Pendências e compromissos com prazo",
    icon: CheckSquare,
    color: "#00D4FF",
  },
  {
    href: "/negocio/financeiro",
    label: "Financeiro",
    description: "MRR, receita e runway — em breve",
    icon: DollarSign,
    color: "#22C55E",
    disabled: true,
  },
];

export default function NegocioPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Negócio</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Dinheiro, pipeline e clientes
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SECTIONS.map(({ href, label, description, icon: Icon, color, disabled }) => {
          const inner = (
            <div
              className="card p-6 flex flex-col gap-4 h-full transition-all"
              style={disabled ? { opacity: 0.5, cursor: "default" } : {}}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${color}18`, border: `1px solid ${color}22` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <p className="font-semibold">{label}</p>
                <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
                  {description}
                </p>
              </div>
            </div>
          );

          return disabled ? (
            <div key={href}>{inner}</div>
          ) : (
            <Link key={href} href={href} className="block">
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
