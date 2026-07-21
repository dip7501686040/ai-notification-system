import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import type { RawListQuery } from "@ai-notification/common";
import type { Notification } from "../../../generated/prisma-client";
import { NotificationsService } from "../notifications.service";

interface NotificationMessage {
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

interface ListQueryMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListNotificationsRequest {
  requester_id: string;
  tenant_id: string;
  status: string;
  query: ListQueryMessage;
}

interface ListNotificationsResponse {
  list: NotificationMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface GetNotificationRequest {
  requester_id: string;
  notification_id: string;
}

function toNotificationMessage(notification: Notification): NotificationMessage {
  return {
    id: notification.id,
    tenant_id: notification.tenantId,
    event_id: notification.eventId,
    rule_id: notification.ruleId ?? "",
    channel: notification.channel,
    target: notification.target,
    payload_json: JSON.stringify(notification.payload),
    status: notification.status,
    attempts: notification.attempts,
    max_attempts: notification.maxAttempts,
    last_error: notification.lastError ?? "",
    next_attempt_at: notification.nextAttemptAt?.toISOString() ?? "",
    sent_at: notification.sentAt?.toISOString() ?? "",
    created_at: notification.createdAt.toISOString(),
    updated_at: notification.updatedAt.toISOString(),
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
export class NotificationGrpcController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @GrpcMethod("Notification", "ListNotifications")
  async listNotifications(data: ListNotificationsRequest): Promise<ListNotificationsResponse> {
    const result = await this.notificationsService.findAllForTenant(
      data.tenant_id,
      data.requester_id,
      toRawListQuery(data.query),
      data.status || undefined,
    );
    return {
      list: result.list.map(toNotificationMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("Notification", "GetNotification")
  async getNotification(data: GetNotificationRequest): Promise<NotificationMessage> {
    const notification = await this.notificationsService.findOne(
      data.notification_id,
      data.requester_id,
    );
    return toNotificationMessage(notification);
  }
}
