import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { NotificationsGateway } from "./notifications.gateway";

const EVENTS_EXCHANGE = "platform";
const PUSH_ROUTING_KEY = "notification.dashboard.push";
const QUEUE_NAME = "api-gateway.notification.dashboard.push";

interface NotificationPushMessage {
  notificationId: string;
  tenantId: string;
  userId: string;
  payload: unknown;
  createdAt: string;
}

// api-gateway's first RabbitMQ consumer -- relays notification-service's
// dashboard-channel pushes to whichever browser socket is currently
// subscribed to that tenant's room. Fire-and-forget: if nobody's
// listening, this simply has no effect (the notification already exists
// in Postgres via notification-service, fetchable later over REST).
@Injectable()
export class NotificationPushConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(EVENTS_EXCHANGE, PUSH_ROUTING_KEY, QUEUE_NAME, (message) =>
      this.handlePush(message as NotificationPushMessage),
    );
  }

  private async handlePush(message: NotificationPushMessage): Promise<void> {
    this.gateway.server.to(`tenant:${message.tenantId}`).emit("notification", message);
  }
}
