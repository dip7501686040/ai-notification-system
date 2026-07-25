import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import type { RawListQuery } from "@ai-notification/common";
import type { AuditLog } from "../../../generated/prisma-client";
import { AuditService } from "../audit.service";

interface AuditLogMessage {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: string;
  created_at: string;
}

interface ListQueryMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListAuditLogsRequest {
  requester_id: string;
  tenant_id: string;
  query: ListQueryMessage;
  days: number;
  action: string;
}

interface ListAuditLogsResponse {
  list: AuditLogMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface ListMyAuditLogsRequest {
  requester_id: string;
  query: ListQueryMessage;
  days: number;
}

function toAuditLogMessage(log: AuditLog): AuditLogMessage {
  return {
    id: log.id,
    tenant_id: log.tenantId ?? "",
    actor_id: log.actorId ?? "",
    action: log.action,
    target_type: log.targetType,
    target_id: log.targetId,
    metadata_json: JSON.stringify(log.metadata ?? {}),
    created_at: log.createdAt.toISOString(),
  };
}

function toRawListQuery(query: ListQueryMessage | undefined): RawListQuery {
  return {
    page: query?.page || undefined,
    limit: query?.limit || undefined,
    search: query?.search || undefined,
    sort_fields: query?.sort_fields || undefined,
    sort_type: query?.sort_type || undefined,
  };
}

@Controller()
export class AuditGrpcController {
  constructor(private readonly auditService: AuditService) {}

  @GrpcMethod("Audit", "ListAuditLogs")
  async listAuditLogs(data: ListAuditLogsRequest): Promise<ListAuditLogsResponse> {
    const result = await this.auditService.findAllForTenant(
      data.tenant_id,
      data.requester_id,
      toRawListQuery(data.query),
      data.days || undefined,
      data.action || undefined,
    );
    return {
      list: result.list.map(toAuditLogMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("Audit", "ListMyAuditLogs")
  async listMyAuditLogs(data: ListMyAuditLogsRequest): Promise<ListAuditLogsResponse> {
    const result = await this.auditService.findMine(
      data.requester_id,
      toRawListQuery(data.query),
      data.days || undefined,
    );
    return {
      list: result.list.map(toAuditLogMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }
}
