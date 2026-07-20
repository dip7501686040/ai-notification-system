import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { validateTokenViaGrpc } from "@ai-notification/grpc";
import { env } from "../env";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

@Injectable()
export class GrpcAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const result = await validateTokenViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, token);
    if (!result.valid) {
      throw new UnauthorizedException(result.error || "Invalid token");
    }

    (request as Request & { user?: AuthenticatedUser }).user = {
      id: result.userId,
      email: result.email,
    };
    return true;
  }
}
