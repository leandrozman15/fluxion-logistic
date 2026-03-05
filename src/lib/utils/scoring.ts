
import { Prospect, TenantSettings } from "@/app/lib/types";

/**
 * Calcula o score efetivo baseado no aiScore e regras de dados.
 * Utiliza os pesos configurados no tenant se estão disponíveis.
 */
export function calculateEffectiveScore(prospect: Partial<Prospect>, settings?: TenantSettings): number {
  // 1. Componente Determinístico (Qualidade de Dados) - Base 0 a 100
  let dataQualityScore = 50; 

  const hasEmail = prospect.contacts?.some(c => !!c.email && c.email.includes('@') && !c.email.includes('gmail') && !c.email.includes('hotmail'));
  const hasGenericEmail = prospect.contacts?.some(c => !!c.email && (c.email.includes('gmail') || c.email.includes('hotmail')));
  const hasPhone = prospect.contacts?.some(c => !!c.phone || !!c.whatsapp);
  const hasWebsite = !!prospect.websiteUrl || !!prospect.domain;
  const hasValidCnpj = !!prospect.cnpj && prospect.cnpj.replace(/\D/g, '').length === 14;
  const hasAiEnrichment = !!prospect.aiWebSummary;

  if (hasEmail) dataQualityScore += 20;
  else if (hasGenericEmail) dataQualityScore += 5;
  
  if (hasWebsite) dataQualityScore += 10;
  if (hasValidCnpj) dataQualityScore += 10;
  if (hasPhone) dataQualityScore += 10;
  
  // Layer 14: Bônus por enriquecimento de site (indica que a empresa tem infraestrutura digital ativa)
  if (hasAiEnrichment) dataQualityScore += 15;

  // Penalidade severa se não for acionável
  if (!hasEmail && !hasGenericEmail && !hasPhone) {
    dataQualityScore = Math.max(0, dataQualityScore - 40);
  }

  // 2. Componente de IA (se disponível)
  const aiPart = prospect.aiScore ?? 50;

  // 3. Score Final
  const mode = settings?.finalScoreMode || 'weighted';
  const weights = settings?.scoringWeights || { effective: 0.6, ai: 0.4 };

  if (mode === 'max' && prospect.aiScore !== undefined) {
    return Math.max(Math.round(dataQualityScore), Math.round(aiPart));
  }

  // Peso Ponderado
  const finalScore = (dataQualityScore * weights.effective) + (aiPart * weights.ai);

  return Math.round(Math.min(Math.max(finalScore, 0), 100));
}
