
import { Prospect } from "@/app/lib/types";

export type NextActionType = 
  | "suggest_emails" 
  | "analyze_website" 
  | "whatsapp_first" 
  | "prepare_email" 
  | "followup" 
  | "none";

export interface NextAction {
  type: NextActionType;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

/**
 * Calculates the "Next Best Action" for a given prospect based on its current state.
 */
export function calculateNextAction(prospect: Prospect): NextAction {
  if (prospect.doNotContact) {
    return { type: "none", label: "Não Contactar", reason: "Prospect em lista DNC.", priority: "low" };
  }

  const hasEmail = prospect.contacts?.some(c => !!c.email);
  const hasPhone = prospect.contacts?.some(c => !!c.phone || !!c.whatsapp);
  const hasWebsite = !!prospect.websiteUrl;
  const hasAiSummary = !!prospect.aiWebSummary;
  const lastContactAt = prospect.lastContactAt ? new Date(prospect.lastContactAt) : null;
  const now = new Date();
  
  // 1. If no contact info but has website -> Suggest Emails
  if (!hasEmail && hasWebsite) {
    return { 
      type: "suggest_emails", 
      label: "Sugerir E-mails", 
      reason: "Sem e-mails de contato, mas possui domínio/site disponível.", 
      priority: "high" 
    };
  }

  // 2. If has website but no AI analysis -> Analyze Website
  if (hasWebsite && !hasAiSummary) {
    return { 
      type: "analyze_website", 
      label: "Analisar Web", 
      reason: "Website disponível para extração de inteligência industrial.", 
      priority: "medium" 
    };
  }

  // 3. If has phone and never contacted -> WhatsApp First
  if (hasPhone && !lastContactAt) {
    return { 
      type: "whatsapp_first", 
      label: "WhatsApp", 
      reason: "Contato direto por celular disponível para primeira abordagem.", 
      priority: "high" 
    };
  }

  // 4. If has email and never contacted -> Prepare Email
  if (hasEmail && !lastContactAt) {
    return { 
      type: "prepare_email", 
      label: "Preparar E-mail", 
      reason: "E-mail disponível para abordagem profissional estruturada.", 
      priority: "high" 
    };
  }

  // 5. If was contacted but more than 2 days ago -> Follow-up
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
