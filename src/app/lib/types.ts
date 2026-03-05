
export type ProspectStatus = 'new' | 'contacted' | 'interested' | 'demo' | 'client' | 'discarded';
export type UserRole = 'admin' | 'sales' | 'viewer';

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
  aiScore: number; // Score puro de Genkit
  effectiveScore: number; // Score ajustado por datos accionables
  scoreReasons: string[];
  isClaimedToday?: boolean;
  lastContactAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
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
