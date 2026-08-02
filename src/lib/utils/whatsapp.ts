/**
 * Normalizes phone numbers to E.164 format.
 * Defaults to Argentina (54) for LogisticaAr, but keeps flexibility.
 */
export function normalizePhone(phone: string, defaultCountryCode = "54"): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");
  
  // If it already has a long international format (e.g. 54911...), return as is
  if (digits.length >= 12 && (digits.startsWith("54") || digits.startsWith("55"))) {
    return digits;
  }

  // Argentinian specific logic: if it starts with 0, remove it
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  // If it's a mobile number without country code (e.g. 11 1234 5678 or 9 11 1234 5678)
  if (digits.length === 10 || digits.length === 11) {
    return defaultCountryCode + digits;
  }
  
  // Fallback for usable lengths
  if (digits.length >= 10 && digits.length <= 15) {
    // If no country code detected, add default
    if (!digits.startsWith(defaultCountryCode)) {
      return defaultCountryCode + digits;
    }
    return digits;
  }
  
  return digits || null;
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
  
  const greeting = contactName ? `Hola ${contactName}, ¿cómo estás?` : "Hola, ¿cómo estás?";
  const context = (city && state) 
    ? `Te escribo por la empresa ${companyName} (${city}/${state}).`
    : `Te escribo por la empresa ${companyName}.`;
    
  return `${greeting}
${context}
¿Podríamos conversar 10 minutos sobre nuestra solución de logística?`;
}

// Legacy alias to avoid breaking existing imports
export const normalizePhoneBR = (p: string) => normalizePhone(p, "55");
