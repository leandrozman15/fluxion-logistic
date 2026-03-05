
import { Prospect } from "@/app/lib/types";

/**
 * Calcula el score efectivo basado en el score de IA y la calidad de los datos.
 * Reglas:
 * +10 si tiene email corporativo
 * +5 si tiene dominio
 * +5 si CNPJ es válido
 * -30 si NO tiene email ni teléfono (no accionable)
 */
export function calculateEffectiveScore(prospect: Partial<Prospect>): number {
  let score = prospect.aiScore || 0;

  const hasEmail = prospect.contacts?.some(c => !!c.email);
  const hasPhone = prospect.contacts?.some(c => !!c.phone || !!c.whatsapp);
  const hasDomain = !!prospect.domain || !!prospect.websiteUrl;
  const hasValidCnpj = !!prospect.cnpj && prospect.cnpj.length >= 14;

  if (hasEmail) score += 10;
  if (hasDomain) score += 5;
  if (hasValidCnpj) score += 5;

  if (!hasEmail && !hasPhone) {
    score -= 30;
  }

  // Normalizar entre 0 y 100
  return Math.min(Math.max(score, 0), 100);
}
