export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  provider: string;
  isSuperAdmin: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface TenantWithRole extends Tenant {
  role: TenantRole;
}

export type TenantRole = "owner" | "admin" | "member";

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  createdAt: string;
}

export interface Paginated<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Rule {
  id: string;
  tenantId: string;
  name: string;
  eventType: string;
  conditions: unknown;
  actions: RuleAction[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleAction {
  channel: string;
  target: string;
  template?: string;
}

export interface Template {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventItem {
  id: string;
  tenantId: string;
  type: string;
  source: string;
  payload: unknown;
  status: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  eventId: string;
  ruleId: string | null;
  channel: string;
  target: string;
  payload: { subject?: string; body?: string } & Record<string, unknown>;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  nextAttemptAt: string;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
  readStatus: "unread" | "read";
}

export interface DailyEventCount {
  date: string;
  count: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface ChannelNotificationStats {
  channel: string;
  sent: number;
  failed: number;
  estimatedCost: number;
}

export interface NotificationStats {
  byChannel: ChannelNotificationStats[];
  totalSent: number;
  totalFailed: number;
  successRate: number;
  totalEstimatedCost: number;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  rateLimit: number;
  revoked: boolean;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedApiKey {
  apiKey: ApiKey;
  rawKey: string;
}

export interface EventAnalysis {
  id: string;
  tenantId: string;
  eventId: string;
  type: string;
  provider: string;
  model: string;
  summary: string;
  category: string;
  severity: string;
  businessImpact: string;
  recommendation: string;
  isDuplicate: boolean;
  duplicateOfEventId: string;
  status: string;
  error: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConfig {
  tenantId: string;
  provider: string;
  model: string;
}
