export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TenantScoped {
  tenantId: string;
}

export type Severity = "low" | "medium" | "high" | "critical";
