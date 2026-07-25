import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { PrismaService } from "../prisma/prisma.service";

const EXCHANGE = "platform";
const EVENT_CREATED_ROUTING_KEY = "event.created";
const NOTIFICATION_SENT_ROUTING_KEY = "notification.sent";
const NOTIFICATION_DEAD_ROUTING_KEY = "notification.dead";
const NOTIFICATION_DASHBOARD_PUSH_ROUTING_KEY = "notification.dashboard.push";
const EVENT_CREATED_QUEUE = "analytics.event.created";
const NOTIFICATION_SENT_QUEUE = "analytics.notification.sent";
const NOTIFICATION_DEAD_QUEUE = "analytics.notification.dead";
const NOTIFICATION_DASHBOARD_PUSH_QUEUE = "analytics.notification.dashboard.push";
const DASHBOARD_CHANNEL = "dashboard";

interface EventCreatedMessage {
  eventId: string;
  tenantId: string;
  type: string;
  source?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface NotificationSentMessage {
  notificationId: string;
  tenantId: string;
  channel: string;
  target: string;
}

interface NotificationDeadMessage {
  notificationId: string;
  tenantId: string;
  channel: string;
  target: string;
  error: string;
}

// The dashboard channel never publishes `notification.sent` -- it's
// fire-and-forget (see notification-service's own comment on that
// branch) and publishes this instead, with no `channel` field since it's
// always dashboard. Without consuming this too, dashboard would be
// silently absent from every notification stat -- confirmed missing
// during live end-to-end verification.
interface NotificationDashboardPushMessage {
  notificationId: string;
  tenantId: string;
  userId: string;
  payload: unknown;
  createdAt: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Fourth/fifth/sixth consumers in the codebase, all on the `platform`
// exchange rule-engine-service/notification-service already bind to.
// Aggregates only -- never stores the raw event/notification rows
// event-service/notification-service already own, per "database per
// service, no cross-service joins."
@Injectable()
export class AnalyticsConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(
      EXCHANGE,
      EVENT_CREATED_ROUTING_KEY,
      EVENT_CREATED_QUEUE,
      (message) => this.handleEventCreated(message as EventCreatedMessage),
    );
    await this.rabbitmq.consume(
      EXCHANGE,
      NOTIFICATION_SENT_ROUTING_KEY,
      NOTIFICATION_SENT_QUEUE,
      (message) => this.handleNotificationSent(message as NotificationSentMessage),
    );
    await this.rabbitmq.consume(
      EXCHANGE,
      NOTIFICATION_DEAD_ROUTING_KEY,
      NOTIFICATION_DEAD_QUEUE,
      (message) => this.handleNotificationDead(message as NotificationDeadMessage),
    );
    await this.rabbitmq.consume(
      EXCHANGE,
      NOTIFICATION_DASHBOARD_PUSH_ROUTING_KEY,
      NOTIFICATION_DASHBOARD_PUSH_QUEUE,
      (message) =>
        this.handleNotificationDashboardPush(message as NotificationDashboardPushMessage),
    );
  }

  private async handleEventCreated(message: EventCreatedMessage): Promise<void> {
    const date = today();
    const source = message.source ?? "";
    await this.prisma.dailyEventStat.upsert({
      where: {
        tenantId_date_eventType_source: {
          tenantId: message.tenantId,
          date,
          eventType: message.type,
          source,
        },
      },
      create: {
        tenantId: message.tenantId,
        date,
        eventType: message.type,
        source,
        count: 1,
      },
      update: { count: { increment: 1 } },
    });
  }

  private async handleNotificationSent(message: NotificationSentMessage): Promise<void> {
    await this.upsertNotificationStat(message.tenantId, message.channel, { sent: 1 });
  }

  private async handleNotificationDead(message: NotificationDeadMessage): Promise<void> {
    await this.upsertNotificationStat(message.tenantId, message.channel, { failed: 1 });
  }

  private async handleNotificationDashboardPush(
    message: NotificationDashboardPushMessage,
  ): Promise<void> {
    await this.upsertNotificationStat(message.tenantId, DASHBOARD_CHANNEL, { sent: 1 });
  }

  private async upsertNotificationStat(
    tenantId: string,
    channel: string,
    increment: { sent?: number; failed?: number },
  ): Promise<void> {
    const date = today();
    await this.prisma.dailyNotificationStat.upsert({
      where: { tenantId_date_channel: { tenantId, date, channel } },
      create: {
        tenantId,
        date,
        channel,
        sent: increment.sent ?? 0,
        failed: increment.failed ?? 0,
      },
      update: {
        sent: increment.sent ? { increment: increment.sent } : undefined,
        failed: increment.failed ? { increment: increment.failed } : undefined,
      },
    });
  }
}
