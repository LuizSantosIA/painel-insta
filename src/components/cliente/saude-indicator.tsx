import { corSaude, labelSaude, type StatusSaude } from "@/lib/saude";

/**
 * Indicador de saúde do cliente — ponto + rótulo, sem badge colorida grande.
 *
 * O diagnóstico mora em saude.ts e é o mesmo usado pela lista, pelo perfil 360°,
 * pelo dashboard e pela tela de Saúde. Aqui é só a apresentação — e o motivo, que
 * vem pronto da engine, para a classificação nunca aparecer sem explicação.
 */
export function SaudeIndicator({
  status,
  motivo,
  compacto = false,
}: {
  status: StatusSaude;
  motivo?: string;
  compacto?: boolean;
}) {
  const cor = corSaude(status);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={motivo}>
      <span
        aria-hidden
        className="inline-block h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: cor, boxShadow: `0 0 0 3px color-mix(in srgb, ${cor} 13%, transparent)` }}
      />
      <span className={`${compacto ? "text-[11px]" : "text-[12px]"} text-foreground-2`}>
        {labelSaude(status)}
      </span>
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  active: "Cliente",
  inactive: "Inativo",
  lost: "Perdido",
};

const STATUS_CLASSES: Record<string, string> = {
  lead: "border-blue-400/25 text-blue-300",
  active: "border-emerald-400/25 text-emerald-300",
  inactive: "border-zinc-400/20 text-zinc-400",
  lost: "border-rose-400/25 text-rose-300",
};

export const STATUS_CLIENTE = ["lead", "active", "inactive", "lost"] as const;

export function labelStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Badge discreta de status: contorno e texto, sem preenchimento chapado. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-[1px] text-[11px] font-medium ${
        STATUS_CLASSES[status] ?? "border-border text-muted"
      }`}
    >
      {labelStatus(status)}
    </span>
  );
}

/** Inicial do nome, para a coluna Cliente e o cabeçalho do perfil. */
export function Avatar({ nome, tamanho = 26 }: { nome: string; tamanho?: number }) {
  const inicial = nome.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.42),
        background: "linear-gradient(135deg, #4F8CFF 0%, #7C5CFF 100%)",
      }}
    >
      {inicial}
    </span>
  );
}
