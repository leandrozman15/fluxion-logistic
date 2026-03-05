
import { SegmentStats, Prospect, WeeklyStats } from "@/app/lib/types";

/**
 * Utilitários para o Learning Loop: aprendizado de performance por segmento industrial.
 */

export function getSegmentKey(prospect: Partial<Prospect>): string | null {
  const tag = prospect.industryTags?.[0];
  const state = prospect.address?.state;
  if (!tag || !state) return null;
  return `${tag.toLowerCase().replace(/\s+/g, '_')}_${state.toUpperCase()}`;
}

export function calculateSegmentPerformance(stats: Partial<SegmentStats>): { 
  preferredChannel: 'email' | 'whatsapp' | 'none', 
  confidence: number 
} {
  const emailRate = stats.emailAttempts ? (stats.emailInterested || 0) / stats.emailAttempts : 0;
  const waRate = stats.whatsappAttempts ? (stats.whatsappInterested || 0) / stats.whatsappAttempts : 0;
  const sampleSize = (stats.emailAttempts || 0) + (stats.whatsappAttempts || 0);

  if (sampleSize < 5) return { preferredChannel: 'none', confidence: 0 };

  // Confidence calculation based on sample size (logarithmic growth)
  const confidence = Math.min(Math.log10(sampleSize + 1) / 2, 0.95);

  if (waRate > emailRate * 1.2) return { preferredChannel: 'whatsapp', confidence };
  if (emailRate > waRate * 1.2) return { preferredChannel: 'email', confidence };

  return { preferredChannel: 'none', confidence: 0.5 };
}
