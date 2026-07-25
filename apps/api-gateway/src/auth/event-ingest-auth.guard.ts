import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { validateApiKeyViaGrpc } from "@ai-notification/grpc";
import { env } from "../env";
import { GrpcAuthGuard } from "./grpc-auth.guard";
import { ApiKeyRateLimiterService } from "./api-key-rate-limiter.service";

// POST /events accepts *either* auth mode (FR-1's "Validate API Key"
// acceptance criterion, alongside the existing JWT flow for dashboard
// users posting test events): an X-API-Key header authenticates without
// a user identity at all; its absence falls through to the existing
// GrpcAuthGuard (injected, not duplicated) unchanged.
@Injectable()
export class EventIngestAuthGuard implements CanActivate {
  constructor(
    private readonly grpcAuthGuard: GrpcAuthGuard,
    private readonly rateLimiter: ApiKeyRateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers["x-api-key"];
    const rawKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

    if (!rawKey) {
      return this.grpcAuthGuard.canActivate(context);
    }

    const result = await validateApiKeyViaGrpc(env.TENANT_GRPC_ADDRESS, rawKey);
    if (!result.valid) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }

    const withinLimit = await this.rateLimiter.checkAndIncrement(result.apiKeyId, result.rateLimit);
    if (!withinLimit) {
      throw new HttpException("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    (request as Request & { apiKeyTenantId?: string }).apiKeyTenantId = result.tenantId;
    return true;
  }
}
