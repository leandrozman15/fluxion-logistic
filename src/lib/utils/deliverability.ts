
/**
 * Utilities for ensuring email deliverability and preventing spam.
 */

export type EmailQuality = "corporate" | "generic" | "spam";

const GENERIC_PREFIXES = [
  'contato', 'vendas', 'info', 'compras', 'comercial', 'diretoria', 
  'sac', 'rh', 'financeiro', 'recepcao', 'suporte', 'atendimento',
  'admin', 'office', 'marketing', 'ajuda'
];

const SPAM_KEYWORDS = [
  'ganhe', 'dinheiro', 'grátis', 'urgente', 'oportunidade única',
  'oferta', 'promoção', 'clique aqui', 'venda', 'preço', 'desconto'
];

/**
 * Classifies an email based on its address pattern.
 */
export function checkEmailQuality(email: string): EmailQuality {
  if (!email || !email.includes('@')) return "spam";
  
  const [prefix, domain] = email.toLowerCase().split('@');
  
  // 1. Check for common generic prefixes
  if (GENERIC_PREFIXES.includes(prefix)) {
    return "generic";
  }

  // 2. Check for public/free domains
  const publicDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'terra.com.br', 'uol.com.br'];
  if (publicDomains.includes(domain)) {
    return "generic";
  }

  return "corporate";
}

/**
 * Calculates a spam score (0-100) based on content analysis.
 * Higher score means more likely to be spam.
 */
export function calculateSpamProbability(subject: string, body: string): number {
  let score = 0;
  const fullText = (subject + " " + body).toLowerCase();

  // 1. Link density (too many links are suspicious)
  const linkCount = (body.match(/<a /g) || []).length || (body.match(/http/g) || []).length;
  if (linkCount > 3) score += 30;
  if (linkCount > 5) score += 50;

  // 2. Spam keywords
  SPAM_KEYWORDS.forEach(keyword => {
    if (fullText.includes(keyword)) score += 15;
  });

  // 3. Short body
  if (body.length < 50) score += 20;

  // 4. Excessive caps in subject
  const capsCount = (subject.match(/[A-Z]/g) || []).length;
  if (subject.length > 5 && capsCount / subject.length > 0.5) score += 40;

  return Math.min(score, 100);
}

/**
 * Checks if a prospect is in cooldown for email sending.
 */
export function isEmailOnCooldown(lastSentAt?: string, days = 3): boolean {
  if (!lastSentAt) return false;
  const lastDate = new Date(lastSentAt);
  const now = new Date();
  const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
  return diffDays < days;
}
