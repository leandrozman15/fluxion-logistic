
/**
 * Normalizes Brazilian phone numbers to E.164 format (55 + DDD + number).
 */
export function normalizePhoneBR(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Basic validation for Brazilian numbers
  // Format: 55 (country) + 11 (DDD) + 9 (mobile prefix) + 8 digits = 13 total
  // Or: 55 (country) + 11 (DDD) + 8 digits = 12 total
  // Or: 11 (DDD) + 9 (mobile prefix) + 8 digits = 11 total
  // Or: 11 (DDD) + 8 digits = 10 total
  
  let normalized = digits;
  
  // If it doesn't have the country code, add it
  if (normalized.length === 10 || normalized.length === 11) {
    normalized = "55" + normalized;
  }
  
  // Final check: should be 12 or 13 digits starting with 55
  if (normalized.startsWith("55") && (normalized.length === 12 || normalized.length === 13)) {
    return normalized;
  }
  
  // Fallback for numbers that might be longer/shorter but look usable
  if (normalized.length >= 10 && normalized.length <= 15) {
    return normalized;
  }
  
  return null;
}

/**
 * Builds a wa.me URL with an optional pre-filled text.
 */
export function buildWaMeUrl(phoneE164: string, text?: string): string {
  const baseUrl = `https://wa.me/${phoneE164}`;
  if (!text) return baseUrl;
  return `${baseUrl}?text=${encodeURIComponent(text)}`;
}

/**
 * Generates a base WhatsApp message for industrial prospects.
 */
export function buildWhatsAppMessage(prospect: any): string {
  const contactName = prospect.contacts?.[0]?.name || "";
  const companyName = prospect.companyName || "";
  const city = prospect.address?.city || "";
  const state = prospect.address?.state || "";
  
  const greeting = contactName ? `Olá ${contactName}, tudo bem?` : "Olá, tudo bem?";
  const context = (city && state) 
    ? `Estou entrando em contato sobre a ${companyName} (${city}/${state}).`
    : `Estou entrando em contato sobre a ${companyName}.`;
    
  return `${greeting}
${context}
Posso te explicar rapidamente uma solução para organizar e priorizar oportunidades comerciais/operacionais na indústria?
Se fizer sentido, posso te mostrar em 10-15 min.`;
}
