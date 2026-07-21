export interface Paginated<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TenantScoped {
  tenantId: string;
}

export type Severity = "low" | "medium" | "high" | "critical";
