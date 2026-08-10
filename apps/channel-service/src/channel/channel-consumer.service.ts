import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import { getTraceContext } from "@ai-notification/telemetry";
import { ChannelDispatchService } from "./channel-dispatch.service";
import { env } from "../env";

const EXCHANGE = "platform";
const NOTIFICATION_CREATED_ROUTING_KEY = "notification.created";
const QUEUE_NAME = "channel-service.notification.created";
const DASHBOARD_CHANNEL = "dashboard";

interface NotificationCreatedMessage {
  notificationId: string;
  tenantId: string;
  eventId: string;
  ruleId: string | null;
  channel: string;
  target: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

// Async dispatch worker: notification-service publishes notification.created
// (both for a brand-new notification and for a retry redispatch) and moves
// on without waiting -- this consumer does the actual send (real network
// I/O: SMTP, webhook HTTP calls) and reports the outcome back over
// RabbitMQ, so a slow provider only blocks this one queue's throughput,
// never notification-service's. Stateless: attempts/maxAttempts travel in
// the message since this service has no database of its own.
@Injectable()
export class ChannelConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ChannelConsumerService.name);
  // Structured (pino) logger for the demo pipeline log lines only -- keeps
  // field names identical across every service for Loki filtering.
  private readonly structuredLogger = createLogger("channel-service");
  private readonly retryBackoffMs: number[];

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly channelDispatchService: ChannelDispatchService,
  ) {
    this.retryBackoffMs = env.RETRY_BACKOFF_MS.split(",").map((value) => Number(value.trim()));
  }

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(EXCHANGE, NOTIFICATION_CREATED_ROUTING_KEY, QUEUE_NAME, (message) =>
      this.handleNotificationCreated(message as NotificationCreatedMessage),
    );
  }

  private async handleNotificationCreated(message: NotificationCreatedMessage): Promise<void> {
    this.structuredLogger.info(
      {
        ...getTraceContext(),
        event_type: "notification.created",
        step: "consume",
        notificationId: message.notificationId,
        tenantId: message.tenantId,
      },
      "[channel-service]: Consumed notification.created",
    );
    // DEMO BREAKPOINT: after consuming notification.created
    if (message.channel === DASHBOARD_CHANNEL) {
      await this.dispatchDashboard(message);
      return;
    }

    const result = await this.channelDispatchService.dispatch(
      message.channel,
      message.target,
      message.payload,
    );

    if (result.success) {
      await this.publishSent(message);
      return;
    }

    const attempts = message.attempts + 1;
    if (attempts >= message.maxAttempts) {
      await this.publishDead(message, attempts, result.error ?? "Unknown error");
      return;
    }

    const delay =
      this.retryBackoffMs[Math.min(attempts - 1, this.retryBackoffMs.length - 1)] ?? 60000;
    await this.publishRetry(
      message,
      attempts,
      new Date(Date.now() + delay).toISOString(),
      result.error ?? "Unknown error",
    );
  }

  // Dashboard is a best-effort, real-time push (not a guaranteed external
  // send) -- there's no meaningful "retry" for it, so it always counts as
  // delivered, matching this channel's original semantics before dispatch
  // moved here. Publishes only notification.dashboard.push, not
  // notification.sent -- analytics-service tallies dashboard delivery off
  // the push event alone (see its own comment on that), so also
  // publishing notification.sent here would double-count it. notification-
  // service's result consumer treats notification.dashboard.push as its
  // "sent" signal for this row.
  private async dispatchDashboard(message: NotificationCreatedMessage): Promise<void> {
    try {
      this.structuredLogger.info(
        {
          ...getTraceContext(),
          event_type: "notification.dashboard.push",
          step: "publish",
          notificationId: message.notificationId,
          tenantId: message.tenantId,
        },
        "[channel-service]: Publishing notification.dashboard.push",
      );
      // DEMO BREAKPOINT: before publishing notification.dashboard.push
      await this.rabbitmq.publish(EXCHANGE, "notification.dashboard.push", {
        notificationId: message.notificationId,
        tenantId: message.tenantId,
        userId: message.target,
        payload: message.payload,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish notification.dashboard.push for ${message.notificationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async publishSent(message: NotificationCreatedMessage): Promise<void> {
    try {
      this.structuredLogger.info(
        {
          ...getTraceContext(),
          event_type: "notification.sent",
          step: "publish",
          notificationId: message.notificationId,
          tenantId: message.tenantId,
        },
        "[channel-service]: Publishing notification.sent",
      );
      // DEMO BREAKPOINT: before publishing notification.sent
      await this.rabbitmq.publish(EXCHANGE, "notification.sent", {
        notificationId: message.notificationId,
        tenantId: message.tenantId,
        channel: message.channel,
        target: message.target,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish notification.sent for ${message.notificationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async publishDead(
    message: NotificationCreatedMessage,
    attempts: number,
    error: string,
  ): Promise<void> {
    try {
      await this.rabbitmq.publish(EXCHANGE, "notification.dead", {
        notificationId: message.notificationId,
        tenantId: message.tenantId,
        channel: message.channel,
        target: message.target,
        attempts,
        error,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish notification.dead for ${message.notificationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async publishRetry(
    message: NotificationCreatedMessage,
    attempts: number,
    nextAttemptAt: string,
    error: string,
  ): Promise<void> {
    try {
      await this.rabbitmq.publish(EXCHANGE, "notification.retry", {
        notificationId: message.notificationId,
        tenantId: message.tenantId,
        channel: message.channel,
        target: message.target,
        attempts,
        nextAttemptAt,
        error,
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish notification.retry for ${message.notificationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
