import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import { env } from "../env";
import { ROLES_KEY } from "./roles.decorator";
import type { AuthenticatedUser } from "./grpc-auth.guard";
import { resolveTenantId } from "./resolve-tenant-id";

// Fast-fail companion to each service's own (authoritative) role check --
// resolves tenantId from body/query/params without an extra fetch, so it
// only applies to routes where that resolution is actually correct (see
// readme.md's RBAC entry for exactly which). Must run after
// GrpcAuthGuard in @UseGuards() -- it reads request.user.
@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = this.reflector.get<string[] | undefined>(ROLES_KEY, context.getHandler());
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user: AuthenticatedUser }).user;
    const tenantId = resolveTenantId(request);

    if (!tenantId) {
      throw new BadRequestException("tenantId could not be resolved for this route");
    }

    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, user.id);
    if (!result.isMember || !allowedRoles.includes(result.role)) {
      throw new ForbiddenException("Insufficient tenant role");
    }

    return true;
  }
}
