import type { Request } from "express";

// Shared by TenantRolesGuard and TenantMetricsInterceptor -- resolves
// tenantId from body/query/params without an extra fetch. Only correct
// for routes where one of these actually carries the tenant (see
// readme.md's RBAC entry for which).
export function resolveTenantId(request: Request): string | undefined {
  const body = request.body as Record<string, unknown> | undefined;
  const query = request.query as Record<string, unknown> | undefined;
  const params = request.params as Record<string, unknown> | undefined;
  return (
    (typeof body?.tenantId === "string" ? body.tenantId : undefined) ??
    (typeof query?.tenantId === "string" ? query.tenantId : undefined) ??
    (typeof params?.id === "string" ? params.id : undefined)
  );
}
