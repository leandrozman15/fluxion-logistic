
import { Prospect, SegmentStats, SequenceEnrollment, Sequence } from "@/app/lib/types";

export type NextActionType = 
  | "suggest_emails" 
  | "analyze_website" 
  | "whatsapp_first" 
  | "prepare_email" 
  | "followup" 
  | "sequence_step"
  | "none";

export interface NextAction {
  type: NextActionType;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
  channelRecommendation?: 'email' | 'whatsapp';
  sequenceStepIndex?: number;
}

/**
 * Calculates the "Next Best Action" for a given prospect based on its current state,
 * segment performance data (Learning Loop), and active sequence enrollments.
 */
export function calculateNextAction(
  prospect: Prospect, 
  segmentStats?: SegmentStats | null,
  activeEnrollment?: SequenceEnrollment | null,
  sequence?: Sequence | null
): NextAction {
  if (prospect.doNotContact) {
    return { type: "none", label: "Não Contactar", reason: "Prospect em lista DNC.", priority: "low" };
  }

  // 1. Prioritize Sequence Steps if enrollment is active and due
  if (activeEnrollment && activeEnrollment.state === 'active' && sequence) {
    const nextStep = sequence.steps[activeEnrollment.nextStepIndex];
    if (nextStep) {
      const startedAt = activeEnrollment.startedAt?.toDate ? activeEnrollment.startedAt.toDate() : new Date(activeEnrollment.startedAt);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 3600 * 24));
      
      if (diffDays >= nextStep.dayOffset) {
        const channelLabel = nextStep.channel === 'whatsapp' ? 'WhatsApp' : nextStep.channel === 'email' ? 'E-mail' : 'Tarefa';
        return {
          type: "sequence_step",
          label: `Próximo Passo: ${channelLabel}`,
          reason: `Sequência "${sequence.name}" - Passo ${activeEnrollment.nextStepIndex + 1} disponível.`,
          priority: "high",
          channelRecommendation: nextStep.channel !== 'task_only' ? nextStep.channel : undefined,
          sequenceStepIndex: activeEnrollment.nextStepIndex
        };
      }
    }
  }

  const hasEmail = prospect.contacts?.some(c => !!c.email);
  const hasPhone = prospect.contacts?.some(c => !!c.phone || !!c.whatsapp);
  const hasWebsite = !!prospect.websiteUrl;
  const hasAiSummary = !!prospect.aiWebSummary;
  const lastContactAt = prospect.lastContactAt ? new Date(prospect.lastContactAt) : null;
  const now = new Date();
  
  // Learning Loop integration
  const preferred = segmentStats?.preferredChannel || 'none';
  
  // 2. Data Enrichment Actions
  if (!hasEmail && hasWebsite) {
    return { 
      type: "suggest_emails", 
      label: "Sugerir E-mails", 
      reason: "Sem e-mails de contato, mas possui domínio/site disponível.", 
      priority: "high" 
    };
  }

  if (hasWebsite && !hasAiSummary) {
    return { 
      type: "analyze_website", 
      label: "Analisar Web", 
      reason: "Website disponível para extração de inteligência industrial.", 
      priority: "medium" 
    };
  }

  // 3. First Contact Logic
  if (!lastContactAt) {
    if (hasPhone && (preferred === 'whatsapp' || !hasEmail)) {
      return { 
        type: "whatsapp_first", 
        label: "WhatsApp", 
        reason: preferred === 'whatsapp' 
          ? "Canal com maior conversão histórica para este setor." 
          : "Contato direto por celular disponível.", 
        priority: "high",
        channelRecommendation: 'whatsapp'
      };
    }
    
    if (hasEmail) {
      return { 
        type: "prepare_email", 
        label: "Preparar E-mail", 
        reason: preferred === 'email' 
          ? "Canal preferencial detectado pela IA para este nicho." 
          : "E-mail disponível para abordagem estruturada.", 
        priority: "high",
        channelRecommendation: 'email'
      };
    }
  }

  // 4. Follow-up Logic
  if (lastContactAt && prospect.status !== 'client' && prospect.status !== 'discarded') {
    const diffDays = Math.ceil((now.getTime() - lastContactAt.getTime()) / (1000 * 3600 * 24));
    if (diffDays >= 2) {
      return { 
        type: "followup", 
        label: "Follow-up", 
        reason: `Último contato há ${diffDays} dias. Reengajamento necessário.`, 
        priority: "medium" 
      };
    }
  }

  return { type: "none", label: "Aguardar", reason: "Sem ações urgentes no momento.", priority: "low" };
}
