import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

// Marks a route as requiring one of the given tenant roles (owner/admin/
// member). TenantRolesGuard reads this metadata; routes without it are
// left as membership-only (or unauthenticated, if GrpcAuthGuard isn't
// applied either).
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
