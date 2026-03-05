
export type ProspectStatus = 'new' | 'contacted' | 'interested' | 'demo' | 'client' | 'discarded';
export type UserRole = 'admin' | 'sales' | 'viewer';
export type OutboxState = 'draft' | 'queued' | 'sent' | 'failed' | 'canceled';
export type AiConfidence = 'low' | 'medium' | 'high';
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'finished';
export type TaskState = 'open' | 'done' | 'snoozed';
export type TaskType = 'followup_whatsapp' | 'followup_email' | 'call' | 'check_website';
export type SequenceState = 'active' | 'paused' | 'completed' | 'canceled';

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
  source: 'manual' | 'csv' | 'web' | 'referral' | 'auto_discovery' | 'radar_index';
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
  aiDetectedKeywords?: string[];
  
  // AI Email Suggestions
  aiEmailDomainUsed?: string;
  aiEmailSuggestedAt?: string;
  aiEmailSuggestions?: {
    email: string;
    type: "verified_on_site" | "pattern_guess" | "generic_role";
    confidence: AiConfidence;
    reason: string;
  }[];
  
  // Layer 15: Close Probability
  closeProbability?: number;
  closeProbabilityConfidence?: AiConfidence;
  closeProbabilityUpdatedAt?: string;
  closeProbabilityDrivers?: Array<{ factor: string; impact: "positive" | "negative"; evidence: string }>;
  closeProbabilityModelVersion?: string;

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

  // Deliverability tracking
  emailAttempts?: number;
  lastEmailSentAt?: string;

  // Discovery specific
  isRecentlyCreated?: boolean;
  isIndustrialHub?: boolean;

  // Sequence state
  activeSequenceId?: string;
  activeSequenceStepIndex?: number;
}

export interface SequenceStep {
  dayOffset: number;
  channel: 'whatsapp' | 'email' | 'task_only';
  templateId?: string;
  useAgent?: boolean;
  purpose: 'first_touch' | 'followup' | 'handoff' | 'final';
}

export interface Sequence {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  steps: SequenceStep[];
  rules: {
    cooldownDays: number;
    maxEmailAttempts: number;
    requireContactMethod: 'email_or_phone' | 'email_only' | 'none';
    respectDNC: boolean;
  };
  createdAt: any;
  updatedAt: any;
}

export interface SequenceEnrollment {
  id: string;
  tenantId: string;
  prospectId: string;
  sequenceId: string;
  state: SequenceState;
  startedAt: any;
  nextStepIndex: number;
  lastStepAt: any | null;
  log: Array<{
    stepIndex: number;
    createdTaskId?: string;
    createdOutboxId?: string;
    createdAt: string;
  }>;
}

export interface IndustryIndexCompany {
  id: string;
  companyName: string;
  cnpj: string;
  city: string;
  state: string;
  industryTag: string;
  cnae: string;
  website?: string;
  employeesRange: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  foundedYear: number;
  isIndustrialHub?: boolean;
  radarScore?: number;
}

export interface Task {
  id: string;
  tenantId: string;
  prospectId: string;
  companyName?: string;
  type: TaskType;
  dueAt: any;
  state: TaskState;
  assignedTo: string;
  createdAt: any;
  createdBy: string;
  notes?: string;
  sequenceEnrollmentId?: string;
  sequenceStepIndex?: number;
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

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  status: CampaignStatus;
  templateId: string;
  sentCount: number;
  failedCount: number;
  createdAt: any;
  scheduledAt?: string;
  finishedAt?: string;
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
  templateId?: string;
  prospectId: string;
  campaignId: string | null;
  attempts: number;
  lastError: string | null;
  dedupeKey?: string;
  aiUsed?: boolean;
  companyName: string;
  effectiveScore: number;
  sequenceEnrollmentId?: string;
}

export interface DailyTop {
  id: string;
  date: string;
  limit: number;
  generatedAt: string;
  items: {
    prospectId: string;
    companyName: string;
    effectiveScore: number;
    closeProbability?: number;
    hasEmail: boolean;
    hasPhone: boolean;
    hasWebsite: boolean;
    reasons: string[];
  }[];
}

export interface DailyStats {
  id: string;
  date: string;
  quotaLimit: number;
  quotaUsed: number;
  emailsSent: number;
  emailsFailed: number;
  emailsDelivered?: number;
  whatsappOpened: number;
  radarAvgFinalScore: number;
  newProspects: number;
  createdAt?: any;
}

export interface WeeklyStats {
  id: string;
  weekId: string;
  statusChangedTo_contacted: number;
  statusChangedTo_interested: number;
  statusChangedTo_demo: number;
  statusChangedTo_client: number;
  emailsSentCount: number;
  emailInterestedCount: number;
  whatsappOpenedCount: number;
  whatsappInterestedCount: number;
  reconciledAt?: any;
}

export interface SegmentStats {
  id: string;
  tenantId: string;
  industryTag: string;
  state: string;
  emailAttempts: number;
  emailInterested: number;
  whatsappAttempts: number;
  whatsappInterested: number;
  preferredChannel: 'email' | 'whatsapp' | 'none';
  confidence: number;
  sampleSize: number;
  updatedAt: any;
}

export interface Contact {
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp?: string;
  verified?: boolean;
  source?: "manual" | "csv" | "ai_suggestion" | "website";
  quality?: "corporate" | "generic" | "spam";
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
  onboardingCompleted?: boolean;
  autoDiscoveryEnabled: boolean;
  autoDiscoveryStates: string[];
  autoDiscoveryCNAE: string[];
  autoDiscoveryLimitPerWeek: number;
  lastDiscoveryRunAt?: string;
  lastDiscoveryCount?: number;
  warmupModeEnabled?: boolean;
  spamProtectionLevel?: 'low' | 'medium' | 'high';
  maxAttemptsPerProspect?: number;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  settings: TenantSettings;
}
