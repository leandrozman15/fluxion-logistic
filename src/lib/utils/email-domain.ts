
/**
 * Utility for deriving domains and extracting emails from text.
 */

export function deriveDomain(customDomain?: string, websiteUrl?: string, existingEmails: string[] = []): string | null {
  // 1. If explicit domain exists
  if (customDomain && customDomain.includes('.')) {
    return customDomain.toLowerCase().trim();
  }

  // 2. Derive from Website URL
  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
      const hostname = url.hostname.replace('www.', '');
      if (hostname.includes('.')) return hostname.toLowerCase();
    } catch (e) {
      // Invalid URL
    }
  }

  // 3. Derive from existing emails
  for (const email of existingEmails) {
    if (email && email.includes('@')) {
      const domain = email.split('@')[1];
      // Skip common generic domains
      const generic = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'terra.com.br', 'uol.com.br'];
      if (domain && !generic.includes(domain.toLowerCase())) {
        return domain.toLowerCase();
      }
    }
  }

  return null;
}

export function extractEmailsFromText(text: string): string[] {
  if (!text) return [];
  const regex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const matches = text.match(regex) || [];
  
  // Clean and dedupe
  return Array.from(new Set(
    matches.map(m => m.toLowerCase().trim())
      .filter(m => !m.includes('example.com') && !m.includes('teste'))
  ));
}
