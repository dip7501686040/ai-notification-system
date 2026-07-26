import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "./grpc-auth.guard";

// Fast-fail companion to tenant-service's own independent super-admin
// check (via identity-service's GetUser) -- same defense-in-depth shape
// as TenantRolesGuard. Must run after GrpcAuthGuard -- it reads
// request.user.isSuperAdmin, which GrpcAuthGuard's own gRPC round trip
// already resolved.
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user: AuthenticatedUser }).user;

    if (!user.isSuperAdmin) {
      throw new ForbiddenException("Super admin access required");
    }

    return true;
  }
}
