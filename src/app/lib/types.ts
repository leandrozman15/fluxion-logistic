
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
  createdBy: string; // User UID
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
  auditLog: AuditEntry[];
}

export interface AuditEntry {
  timestamp: string;
  userId: string;
  action: string;
  previousValue?: any;
  newValue?: any;
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
  settings: {
    dailyEmailLimit: number;
    hourlyEmailLimit: number;
    timezone: string;
  };
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
  rateLimitConfig?: {
    emailsPerHour: number;
  };
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

export interface ImportRecord {
  id: string;
  tenantId: string;
  createdAt: string;
  createdBy: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
  totalRows: number;
  importedRows: number;
  errorLog: string[];
}
