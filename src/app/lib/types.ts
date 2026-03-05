export type ProspectStatus = 'new' | 'contacted' | 'interested' | 'demo' | 'client' | 'discarded';

export interface Prospect {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
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
  score: number;
  scoreReasons: string[];
  lastContactAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
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
  createdAt: string;
  plan: 'free' | 'pro';
  dailyEmailLimit: number;
  hourlyEmailLimit: number;
  isActive: boolean;
}

export interface Campaign {
  id: string;
  tenantId: string;
  createdAt: string;
  createdBy: string;
  name: string;
  channel: 'email';
  templateId: string;
  filters: {
    statusIn?: ProspectStatus[];
    minScore?: number;
    statesIn?: string[];
    tagsIn?: string[];
  };
  state: 'draft' | 'scheduled' | 'running' | 'paused' | 'finished';
  scheduledAt?: string;
  sentCount: number;
  failedCount: number;
}

export interface Template {
  id: string;
  tenantId: string;
  createdAt: string;
  createdBy: string;
  name: string;
  subject: string;
  body: string;
}