import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface AuditLogResult {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: string;
}

export interface PaginatedAuditLogsResult {
  list: AuditLogResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

interface AuditLogWireMessage {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: string;
  created_at: string;
}

interface ListQueryWireMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListAuditLogsWireResponse {
  list: AuditLogWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

function createClient(address: string): grpc.Client {
  const proto = loadProto("audit.proto") as unknown as {
    audit: { v1: { Audit: grpc.ServiceClientConstructor } };
  };
  return new proto.audit.v1.Audit(address, grpc.credentials.createInsecure());
}

function toAuditLogResult(wire: AuditLogWireMessage): AuditLogResult {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    actorId: wire.actor_id,
    action: wire.action,
    targetType: wire.target_type,
    targetId: wire.target_id,
    metadata: wire.metadata_json ? JSON.parse(wire.metadata_json) : {},
    createdAt: wire.created_at,
  };
}

function toQueryWire(query: AuditLogListQueryParams): ListQueryWireMessage {
  return {
    page: query.page ?? "",
    limit: query.limit ?? "",
    search: query.search ?? "",
    sort_fields: query.sort_fields ?? "",
    sort_type: query.sort_type ?? "",
  };
}

export async function listAuditLogsViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  query: AuditLogListQueryParams,
  days?: number,
  action?: string,
): Promise<PaginatedAuditLogsResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      {
        requester_id: string;
        tenant_id: string;
        query: ListQueryWireMessage;
        days: number;
        action: string;
      },
      ListAuditLogsWireResponse
    >(client, "ListAuditLogs", {
      requester_id: requesterId,
      tenant_id: tenantId,
      query: toQueryWire(query),
      days: days ?? 0,
      action: action ?? "",
    });
    return {
      list: response.list.map(toAuditLogResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function listMyAuditLogsViaGrpc(
  address: string,
  requesterId: string,
  query: AuditLogListQueryParams,
  days?: number,
): Promise<PaginatedAuditLogsResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; query: ListQueryWireMessage; days: number },
      ListAuditLogsWireResponse
    >(client, "ListMyAuditLogs", {
      requester_id: requesterId,
      query: toQueryWire(query),
      days: days ?? 0,
    });
    return {
      list: response.list.map(toAuditLogResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}
