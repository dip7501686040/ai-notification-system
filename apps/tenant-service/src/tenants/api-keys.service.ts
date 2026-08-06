import * as crypto from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import type { ApiKey, Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import type { TenantRole } from "./dto/add-member.dto";
import type { CreateApiKeyDto } from "./dto/create-api-key.dto";

const logger = createLogger("tenant-service");

const MANAGE_ROLES: TenantRole[] = ["owner", "admin"];
const API_KEY_SEARCHABLE_FIELDS = ["name", "keyPrefix"];
const EXCHANGE = "platform";
const AUDIT_CREATED_ROUTING_KEY = "audit.created";
const RAW_KEY_PREFIX = "ntf_";

export interface CreatedApiKey {
  apiKey: ApiKey;
  rawKey: string;
}

export interface ValidateApiKeyResult {
  valid: boolean;
  tenantId?: string;
  apiKeyId?: string;
  rateLimit?: number;
}

function generateRawKey(): string {
  return `${RAW_KEY_PREFIX}${crypto.randomBytes(16).toString("hex")}`;
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// Owned by tenant-service per FR-2 ("Each tenant has ... API Keys"),
// validated at the gateway per the PRD's own "API Gateway
// Responsibilities" diagram. Scoped narrowly to authenticating external
// POST /events calls without a dashboard user's JWT -- not a
// general-purpose credential for every endpoint.
@Injectable()
export class ApiKeysService extends BaseCrudService<
  ApiKey,
  Prisma.ApiKeyCreateInput,
  Prisma.ApiKeyUpdateInput,
  Prisma.ApiKeyWhereUniqueInput,
  Prisma.ApiKeyWhereInput,
  Prisma.ApiKeyOrderByWithRelationInput
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {
    super(prisma.apiKey);
  }

  // Named createKey (not create) -- BaseCrudService.create()'s signature
  // is pinned to Prisma.ApiKeyCreateInput (the relation-object variant,
  // {tenant: {connect: ...}}); this takes a flat tenantId + returns the
  // raw key alongside the row, so it calls the delegate directly instead
  // (same pattern TenantsService.addMember() already uses for
  // TenantMember, its own tenant-relation child entity).
  async createKey(
    tenantId: string,
    requesterId: string,
    dto: CreateApiKeyDto,
  ): Promise<CreatedApiKey> {
    await this.requireRole(tenantId, requesterId, MANAGE_ROLES);

    const rawKey = generateRawKey();
    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyPrefix: rawKey.slice(0, 12),
        keyHash: hashKey(rawKey),
        rateLimit: dto.rateLimit ?? 60,
      },
    });

    await this.publishAudit("apikey.created", apiKey, requesterId);
    return { apiKey, rawKey };
  }

  async findAllForTenant(
    tenantId: string,
    requesterId: string,
    query: RawListQuery,
  ): Promise<Paginated<ApiKey>> {
    await this.requireRole(tenantId, requesterId, MANAGE_ROLES);
    return this.list(query, { searchableFields: API_KEY_SEARCHABLE_FIELDS }, { tenantId });
  }

  async rotate(apiKeyId: string, requesterId: string): Promise<CreatedApiKey> {
    const existing = await this.getApiKeyOrThrow(apiKeyId);
    await this.requireRole(existing.tenantId, requesterId, MANAGE_ROLES);

    const rawKey = generateRawKey();
    const apiKey = await super.update(
      { id: apiKeyId },
      { keyPrefix: rawKey.slice(0, 12), keyHash: hashKey(rawKey) },
    );

    await this.publishAudit("apikey.rotated", apiKey, requesterId);
    return { apiKey, rawKey };
  }

  async revoke(apiKeyId: string, requesterId: string): Promise<void> {
    const existing = await this.getApiKeyOrThrow(apiKeyId);
    await this.requireRole(existing.tenantId, requesterId, MANAGE_ROLES);

    const apiKey = await super.update({ id: apiKeyId }, { revoked: true });
    await this.publishAudit("apikey.revoked", apiKey, requesterId);
  }

  // Internal, no requester -- called by api-gateway's guard on every
  // API-key-authenticated request. Mirrors RulesService.findActiveForEvaluation's
  // "no requester to authorize against, trusted internal caller" shape.
  async validate(rawKey: string): Promise<ValidateApiKeyResult> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash: hashKey(rawKey) } });
    if (!apiKey || apiKey.revoked) {
      return { valid: false };
    }

    await this.prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
    return {
      valid: true,
      tenantId: apiKey.tenantId,
      apiKeyId: apiKey.id,
      rateLimit: apiKey.rateLimit,
    };
  }

  // Best-effort: the key itself is already committed to Postgres by the
  // time this runs (createKey/rotate/revoke all persist first), so a
  // RabbitMQ hiccup here should cost an audit-log entry, not the caller's
  // rawKey -- previously this was awaited unguarded, so a broker blip made
  // API key creation 500 even though the key had already been created.
  private async publishAudit(
    action: "apikey.created" | "apikey.rotated" | "apikey.revoked",
    apiKey: ApiKey,
    actorId: string,
  ): Promise<void> {
    try {
      await this.rabbitmq.publish(EXCHANGE, AUDIT_CREATED_ROUTING_KEY, {
        action,
        tenantId: apiKey.tenantId,
        actorId,
        targetType: "apikey",
        targetId: apiKey.id,
        metadata: { name: apiKey.name, keyPrefix: apiKey.keyPrefix },
      });
    } catch (err) {
      logger.error({ err, action, apiKeyId: apiKey.id }, "Failed to publish audit event");
    }
  }

  private async getApiKeyOrThrow(apiKeyId: string): Promise<ApiKey> {
    const apiKey = await this.findUnique({ id: apiKeyId });
    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }
    return apiKey;
  }

  private async requireRole(
    tenantId: string,
    userId: string,
    allowedRoles: TenantRole[],
  ): Promise<void> {
    const membership = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!membership) {
      throw new NotFoundException("Tenant not found");
    }
    if (!allowedRoles.includes(membership.role as TenantRole)) {
      throw new ForbiddenException("Insufficient tenant role");
    }
  }
}
