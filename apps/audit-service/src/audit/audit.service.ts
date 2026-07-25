import { ForbiddenException, Injectable } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import type { AuditLog, Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";

const AUDIT_SEARCHABLE_FIELDS = ["action", "targetType", "targetId"];
const DEFAULT_DAYS = 30;

function cutoffDate(days?: number): Date {
  const windowDays = days && days > 0 ? days : DEFAULT_DAYS;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  return cutoff;
}

// No public create/update/delete RPC -- every row is written by
// AuditConsumerService off the event bus, never by a caller. Extends
// BaseCrudService purely to reuse `.list()`'s pagination/search/sort.
@Injectable()
export class AuditService extends BaseCrudService<
  AuditLog,
  Prisma.AuditLogCreateInput,
  Prisma.AuditLogUpdateInput,
  Prisma.AuditLogWhereUniqueInput,
  Prisma.AuditLogWhereInput,
  Prisma.AuditLogOrderByWithRelationInput
> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.auditLog);
  }

  async findAllForTenant(
    tenantId: string,
    requesterId: string,
    query: RawListQuery,
    days?: number,
    action?: string,
  ): Promise<Paginated<AuditLog>> {
    await this.assertMembership(tenantId, requesterId);
    return this.list(
      query,
      { searchableFields: AUDIT_SEARCHABLE_FIELDS },
      {
        tenantId,
        createdAt: { gte: cutoffDate(days) },
        ...(action ? { action } : {}),
      },
    );
  }

  // actorId scoping alone is sufficient authorization -- these are the
  // requester's own rows (their own logins, their own rule changes),
  // never anyone else's, so no membership check is needed.
  async findMine(
    requesterId: string,
    query: RawListQuery,
    days?: number,
  ): Promise<Paginated<AuditLog>> {
    return this.list(
      query,
      { searchableFields: AUDIT_SEARCHABLE_FIELDS },
      { actorId: requesterId, createdAt: { gte: cutoffDate(days) } },
    );
  }

  private async assertMembership(tenantId: string, requesterId: string): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      throw new ForbiddenException("Not a member of this tenant");
    }
  }
}
