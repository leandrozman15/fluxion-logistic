
import { Prospect } from "@/app/lib/types";

/**
 * Calcula o score efetivo baseado no aiScore (se existir) e regras determinísticas de qualidade.
 * Peso Sugerido: 60% Regras de Dados (Accionabilidade) + 40% IA (Potencial de Negócio)
 */
export function calculateEffectiveScore(prospect: Partial<Prospect>): number {
  // 1. Componente Determinístico (Qualidade de Dados) - Base 0 a 100
  let dataQualityScore = 50; // Começamos no neutro

  const hasEmail = prospect.contacts?.some(c => !!c.email && c.email.includes('@') && !c.email.includes('gmail') && !c.email.includes('hotmail'));
  const hasGenericEmail = prospect.contacts?.some(c => !!c.email && (c.email.includes('gmail') || c.email.includes('hotmail')));
  const hasPhone = prospect.contacts?.some(c => !!c.phone || !!c.whatsapp);
  const hasWebsite = !!prospect.websiteUrl || !!prospect.domain;
  const hasValidCnpj = !!prospect.cnpj && prospect.cnpj.replace(/\D/g, '').length === 14;

  if (hasEmail) dataQualityScore += 20;
  else if (hasGenericEmail) dataQualityScore += 5;
  
  if (hasWebsite) dataQualityScore += 10;
  if (hasValidCnpj) dataQualityScore += 10;
  if (hasPhone) dataQualityScore += 10;

  // Penalidade severa se não for acionável
  if (!hasEmail && !hasGenericEmail && !hasPhone) {
    dataQualityScore = Math.max(0, dataQualityScore - 40);
  }

  // 2. Componente de IA (se disponível)
  const aiPart = prospect.aiScore ?? 50;

  // 3. Score Final Ponderado
  // Se não tem aiScore, usamos apenas dataQualityScore
  if (prospect.aiScore === undefined) {
    return Math.min(Math.max(dataQualityScore, 0), 100);
  }

  // Peso: 0.6 Data Quality + 0.4 AI
  const finalScore = (dataQualityScore * 0.6) + (aiPart * 0.4);

  return Math.round(Math.min(Math.max(finalScore, 0), 100));
}
