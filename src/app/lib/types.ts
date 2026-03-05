export type ProspectStatus = 'new' | 'contacted' | 'interested' | 'demo' | 'client' | 'discarded';
export type UserRole = 'admin' | 'sales' | 'viewer';
export type OutboxState = 'draft' | 'queued' | 'sent' | 'failed' | 'canceled';
export type AiConfidence = 'low' | 'medium' | 'high';

export interface AppUser {
  uid: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
}

export interface Prospect {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  source: 'manual' | 'csv' | 'web' | 'referral';
  companyName: string;
  cnpj: string;
  industryTags: string[];
  address: {
    city: string;
    state: string;
    country: string;
  };
  websiteUrl?: string;
  domain?: string;
  contacts: Contact[];
  status: ProspectStatus;
  
  // AI Scoring Fields
  aiScore: number; 
  aiScoreConfidence?: AiConfidence;
  aiScoreReasons: string[];
  aiScoreUpdatedAt?: string;
  
  // AI Web Analysis Fields
  aiIndustrySuggestions?: string[];
  aiWebSummary?: string;
  aiWebAnalysisAt?: string;
  
  // AI Email Suggestions
  aiEmailDomainUsed?: string;
  aiEmailSuggestedAt?: string;
  aiEmailSuggestions?: {
    email: string;
    type: "verified_on_site" | "pattern_guess" | "generic_role";
    confidence: AiConfidence;
    reason: string;
  }[];
  
  effectiveScore: number; // Final weighted score used for ranking
  scoreReasons: string[]; // Combined reasons
  
  isClaimedToday?: boolean;
  claimedAt?: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
  notes?: string;

  // Hardening / Compliance
  doNotContact?: boolean;
  doNotContactReason?: string;
  doNotContactAt?: string;
}

export interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  body: string;
  variablesUsed: string[];
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface OutboxMessage {
  id: string;
  tenantId: string;
  createdAt: any;
  createdBy: string;
  updatedAt: any;
  updatedBy: string;
  sentAt: any | null;
  type: 'email';
  state: OutboxState;
  to: string;
  subject: string;
  body: string;
  templateId: string;
  prospectId: string;
  campaignId: string | null;
  attempts: number;
  lastError: string | null;
  dedupeKey: string;
  aiUsed?: boolean;
  companyName: string;
  effectiveScore: number;
}

export interface DailyTop {
  id: string; // YYYY-MM-DD
  date: string;
  limit: number;
  generatedAt: string;
  items: {
    prospectId: string;
    companyName: string;
    effectiveScore: number;
    hasEmail: boolean;
    hasPhone: boolean;
    hasWebsite: boolean;
    reasons: string[];
  }[];
}

export interface DailyStats {
  id: string; // YYYY-MM-DD
  date: string;
  quotaLimit: number;
  quotaUsed: number;
  emailsSent: number;
  emailsFailed: number;
  radarAvgFinalScore: number;
  newProspects: number;
}

export interface WeeklyStats {
  id: string; // YYYY-WW
  weekId: string;
  statusChangedTo_contacted: number;
  statusChangedTo_interested: number;
  statusChangedTo_demo: number;
  statusChangedTo_client: number;
}

export interface Contact {
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp?: string;
  verified?: boolean;
  source?: "manual" | "csv" | "ai_suggestion" | "website";
}

export interface TenantSettings {
  scoringWeights: {
    effective: number;
    ai: number;
  };
  finalScoreMode: 'weighted' | 'max';
  dailyTopLimit: number;
  requireContactMethod: 'email_or_phone' | 'email_only' | 'none';
  cooldownDays: number;
  hourlyEmailLimit: number;
  dailyEmailLimit: number;
  defaultTemplateId: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  settings: TenantSettings;
}
