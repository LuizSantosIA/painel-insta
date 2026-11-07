/**
 * Telefones brasileiros: normalização para E.164 e leitura do tipo.
 *
 * Puro, sem rede. O Google Maps devolve telefone em formatos variados
 * ("+55 61 3234-5678", "(61) 99999-8888", "61 99999 8888"), e o mesmo negócio
 * aparece escrito de jeitos diferentes em buscas diferentes — por isso a
 * deduplicação depende de uma forma canônica.
 */

/** DDDs válidos no Brasil. Fora desta lista o número não é confiável. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type TipoTelefone = "CELULAR" | "FIXO" | "SEM";

export interface TelefoneBR {
  /** +5561999998888 — a forma canônica, usada para deduplicar e para o wa.me. */
  e164: string;
  ddd: number;
  numero: string;
  tipo: TipoTelefone;
}

/**
 * Converte para E.164, ou null se não der para confiar.
 *
 * Celular no Brasil tem 9 dígitos depois do DDD e começa com 9; fixo tem 8.
 * Números de 8 dígitos começando com 9 são celulares antigos, de antes do nono
 * dígito — tratados como fixo, porque não dá para adivinhar o número novo.
 */
export function normalizarTelefone(bruto: string | null | undefined): TelefoneBR | null {
  let d = (bruto ?? "").replace(/\D/g, "");
  if (!d) return null;

  // Tira o 55 do país; tira também o 0 de operadora quando vier colado.
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11 && d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);

  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = Number(d.slice(0, 2));
  if (!DDDS.has(ddd)) return null;

  const numero = d.slice(2);
  if (/^(\d)\1+$/.test(numero)) return null; // 999999999, 000000000: lixo

  const tipo: TipoTelefone = numero.length === 9 && numero.startsWith("9") ? "CELULAR" : "FIXO";

  return { e164: `+55${d}`, ddd, numero, tipo };
}

export function tipoDoTelefone(bruto: string | null | undefined): TipoTelefone {
  return normalizarTelefone(bruto)?.tipo ?? "SEM";
}

/** Link do WhatsApp com a mensagem já preenchida. Só faz sentido em celular. */
export function linkWhatsApp(e164: string, mensagem: string): string {
  const numero = e164.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** (61) 99999-8888 — para ler na tela. */
export function formatarTelefone(e164: string): string {
  const d = e164.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

/**
 * Procura um número de WhatsApp dentro de uma URL — link wa.me, api.whatsapp
 * ou um tel: qualquer. É assim que o número bom costuma aparecer no site,
 * quando o telefone do Maps é o fixo da recepção.
 */
export function whatsAppDaUrl(url: string | null | undefined): TelefoneBR | null {
  const u = url ?? "";
  const m =
    u.match(/wa\.me\/(\d{10,13})/i) ??
    u.match(/api\.whatsapp\.com\/send\?[^#]*phone=(\d{10,13})/i) ??
    u.match(/tel:\+?(\d{10,13})/i);
  return m ? normalizarTelefone(m[1]) : null;
}
