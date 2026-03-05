
export type ProspectStatus = 'new' | 'contacted' | 'interested' | 'demo' | 'client' | 'discarded';
export type UserRole = 'admin' | 'sales' | 'viewer';
export type OutboxState = 'draft' | 'queued' | 'sent' | 'failed' | 'canceled';

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
  aiScore: number; 
  effectiveScore: number; 
  scoreReasons: string[];
  isClaimedToday?: boolean;
  claimedAt?: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
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
  // Denormalized
  companyName: string;
  effectiveScore: number;
}

export interface DailyTop {
  id: string; // YYYY-MM-DD
  date: string;
  limit: number;
  items: {
    prospectId: string;
    companyName: string;
    effectiveScore: number;
    reasons: string[];
  }[];
}

export interface DailyStats {
  id: string; // YYYY-MM-DD
  quotaLimit: number;
  quotaUsed: number;
  emailsSent: number;
}

export interface Contact {
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp?: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  settings: {
    dailyProspectingLimit: number;
    dailyEmailLimit: number;
  };
}
