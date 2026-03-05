
import { Prospect, SegmentStats } from "@/app/lib/types";

export interface BaselineResult {
  baseline: number;
  signals: string[];
}

/**
 * Computa uma probabilidade base determinística baseada nos sinais disponíveis.
 */
export function computeBaselineProbability(prospect: Prospect, segmentData?: SegmentStats | null): BaselineResult {
  if (prospect.doNotContact || prospect.status === 'discarded') {
    return { baseline: 0, signals: ["Prospect marcado como Do Not Contact ou Descartado."] };
  }

  let baseline = 30; // Começamos com uma base neutra de 30%
  const signals: string[] = [];

  // 1. Fit (Encaixe)
  if (prospect.aiWebSummary) {
    baseline += 10;
    signals.push("Análise de website concluída.");
  }

  const hasKeywords = (prospect.aiDetectedKeywords?.length || 0) > 0;
  if (hasKeywords) {
    baseline += 10;
    signals.push("Tecnologias industriais detectadas no site.");
  }

  // 2. Processo (Avanço no Funil)
  switch (prospect.status) {
    case 'interested':
      baseline += 25;
      signals.push("Status: Interessado.");
      break;
    case 'demo':
      baseline += 40;
      signals.push("Status: Demonstração agendada.");
      break;
    case 'contacted':
      baseline += 5;
      signals.push("Primeiro contato realizado.");
      break;
  }

  // 3. Intenção / Recência
  if (prospect.lastContactAt) {
    baseline += 5;
  }

  // 4. Canal e Qualidade
  const hasCorporateEmail = prospect.contacts?.some(c => c.quality === 'corporate');
  if (hasCorporateEmail) {
    baseline += 10;
    signals.push("Possui e-mail corporativo nominal.");
  } else {
    baseline -= 10;
    signals.push("Falta de e-mail corporativo nominal.");
  }

  const preferredMatches = segmentData?.preferredChannel && segmentData.preferredChannel !== 'none';
  if (preferredMatches) {
    baseline += 5;
    signals.push(`Canal preferencial do segmento (${segmentData?.preferredChannel}) disponível.`);
  }

  // 5. Riscos / Penalidades
  if ((prospect.emailAttempts || 0) >= 3 && prospect.status === 'contacted') {
    baseline -= 15;
    signals.push("Múltiplas tentativas sem resposta.");
  }

  return {
    baseline: Math.min(Math.max(baseline, 0), 95), // Deixa 5% pra IA calibrar
    signals
  };
}
