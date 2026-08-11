import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { NotificationsGateway } from "./notifications.gateway";

const EVENTS_EXCHANGE = "platform";
const STATUS_UPDATED_ROUTING_KEY = "notification.status.updated";
const QUEUE_NAME = "api-gateway.notification.status.updated";

interface NotificationStatusUpdatedMessage {
  notificationId: string;
  tenantId: string;
  status: string;
}

// Sibling to NotificationPushConsumerService: that one relays brand-new
// dashboard-channel notifications; this one relays status transitions on
// ANY channel's notification (email/webhook's pending -> sent/retrying/
// dead_letter) so the dashboard's list updates live instead of only on the
// next reload. Uses its own socket event name ("notification_status")
// rather than reusing "notification", so the frontend can quietly refetch
// on a status change instead of treating it like a brand-new notification.
@Injectable()
export class NotificationStatusPushConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(
      EVENTS_EXCHANGE,
      STATUS_UPDATED_ROUTING_KEY,
      QUEUE_NAME,
      (message) => this.handleStatusUpdated(message as NotificationStatusUpdatedMessage),
    );
  }

  private async handleStatusUpdated(message: NotificationStatusUpdatedMessage): Promise<void> {
    this.gateway.server.to(`tenant:${message.tenantId}`).emit("notification_status", message);
  }
}
