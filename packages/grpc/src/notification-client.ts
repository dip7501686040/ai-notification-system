import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface NotificationResult {
  id: string;
  tenantId: string;
  eventId: string;
  ruleId: string;
  channel: string;
  target: string;
  payload: unknown;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  nextAttemptAt: string;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedNotificationsResult {
  list: NotificationResult[];
  total: number;
  page: number;
  pageSize: number;
}

// Same shape as RawListQuery (packages/common/src/list-query.ts) -- kept
// structurally compatible rather than imported (see tenant-client.ts).
export interface NotificationListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

interface NotificationWireMessage {
  id: string;
  tenant_id: string;
  event_id: string;
  rule_id: string;
  channel: string;
  target: string;
  payload_json: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string;
  next_attempt_at: string;
  sent_at: string;
  created_at: string;
  updated_at: string;
}

interface ListQueryWireMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListNotificationsWireResponse {
  list: NotificationWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

function createClient(address: string): grpc.Client {
  const proto = loadProto("notification.proto") as unknown as {
    notification: { v1: { Notification: grpc.ServiceClientConstructor } };
  };
  return new proto.notification.v1.Notification(address, grpc.credentials.createInsecure());
}

function toNotificationResult(wire: NotificationWireMessage): NotificationResult {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    eventId: wire.event_id,
    ruleId: wire.rule_id,
    channel: wire.channel,
    target: wire.target,
    payload: wire.payload_json ? JSON.parse(wire.payload_json) : null,
    status: wire.status,
    attempts: wire.attempts,
    maxAttempts: wire.max_attempts,
    lastError: wire.last_error,
    nextAttemptAt: wire.next_attempt_at,
    sentAt: wire.sent_at,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

function toQueryWire(query: NotificationListQueryParams): ListQueryWireMessage {
  return {
    page: query.page ?? "",
    limit: query.limit ?? "",
    search: query.search ?? "",
    sort_fields: query.sort_fields ?? "",
    sort_type: query.sort_type ?? "",
  };
}

export async function listNotificationsViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  query: NotificationListQueryParams,
  status?: string,
): Promise<PaginatedNotificationsResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; status: string; query: ListQueryWireMessage },
      ListNotificationsWireResponse
    >(client, "ListNotifications", {
      requester_id: requesterId,
      tenant_id: tenantId,
      status: status ?? "",
      query: toQueryWire(query),
    });
    return {
      list: response.list.map(toNotificationResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function getNotificationViaGrpc(
  address: string,
  requesterId: string,
  notificationId: string,
): Promise<NotificationResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; notification_id: string },
      NotificationWireMessage
    >(client, "GetNotification", { requester_id: requesterId, notification_id: notificationId });
    return toNotificationResult(response);
  } finally {
    client.close();
  }
}
