import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { NotificationsService } from "./notifications.service";

const EXCHANGE = "platform";

interface NotificationSentMessage {
  notificationId: string;
}

interface NotificationRetryMessage {
  notificationId: string;
  attempts: number;
  nextAttemptAt: string;
  error: string;
}

interface NotificationDeadMessage {
  notificationId: string;
  attempts: number;
  error: string;
}

interface NotificationDashboardPushMessage {
  notificationId: string;
}

// Reactive counterpart to NotificationsService.requestDispatch: channel-
// service does the actual send and reports what happened over these four
// events, this consumer is the only place that turns that into a
// Notification row update -- notification-service never calls channel-
// service directly (see notifications.service.ts's own comment on
// requestDispatch).
@Injectable()
export class NotificationResultConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(
      EXCHANGE,
      "notification.sent",
      "notification-service.notification.sent",
      (message) => this.handleSent(message as NotificationSentMessage),
    );
    // Dashboard delivery never publishes notification.sent (see channel-
    // service's ChannelConsumerService.dispatchDashboard) -- this is its
    // "sent" signal instead.
    await this.rabbitmq.consume(
      EXCHANGE,
      "notification.dashboard.push",
      "notification-service.notification.dashboard.push",
      (message) => this.handleSent(message as NotificationDashboardPushMessage),
    );
    await this.rabbitmq.consume(
      EXCHANGE,
      "notification.retry",
      "notification-service.notification.retry",
      (message) => this.handleRetry(message as NotificationRetryMessage),
    );
    await this.rabbitmq.consume(
      EXCHANGE,
      "notification.dead",
      "notification-service.notification.dead",
      (message) => this.handleDead(message as NotificationDeadMessage),
    );
  }

  private async handleSent(
    message: NotificationSentMessage | NotificationDashboardPushMessage,
  ): Promise<void> {
    await this.notificationsService.markSent(message.notificationId);
  }

  private async handleRetry(message: NotificationRetryMessage): Promise<void> {
    await this.notificationsService.markRetrying(
      message.notificationId,
      message.attempts,
      message.error,
      new Date(message.nextAttemptAt),
    );
  }

  private async handleDead(message: NotificationDeadMessage): Promise<void> {
    await this.notificationsService.markDeadLetter(
      message.notificationId,
      message.attempts,
      message.error,
    );
  }
}
