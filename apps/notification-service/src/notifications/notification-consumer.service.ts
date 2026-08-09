import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import { getTraceContext } from "@ai-notification/telemetry";
import { NotificationsService, type AiAnalysisSummary } from "./notifications.service";

const EXCHANGE = "platform";
const ROUTING_KEY = "event.ai.completed";
const AUDIT_CREATED_ROUTING_KEY = "audit.created";
const QUEUE_NAME = "notification-service.event.ai.completed";

interface RuleMatchEntry {
  ruleId: string;
  ruleName: string;
  actions: unknown;
}

interface AiCompletedMessage {
  analysisId: string;
  eventId: string;
  tenantId: string;
  type: string;
  source?: string;
  payload: Record<string, unknown>;
  matchedAt: string;
  matches: RuleMatchEntry[];
  provider: string;
  model: string;
  summary: string;
  category: string;
  severity: string;
  businessImpact: string;
  recommendation: string;
  recommendedChannel: string;
  isDuplicate: boolean;
  duplicateOfEventId: string | null;
}

// Pipeline stage 3: event.created -> event.rule.matched -> event.ai.completed
// -> notification.created. Runs after ai-service so every Notification row
// carries both the matched rule's actions and the AI analysis for the same
// event -- ai-service only publishes this once analysis succeeds, so by the
// time this consumer sees a message, both halves are guaranteed present.
@Injectable()
export class NotificationConsumerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumerService.name);
  // Structured (pino) logger for the demo pipeline log lines only -- keeps
  // field names identical across every service for Loki filtering.
  private readonly structuredLogger = createLogger("notification-service");

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(EXCHANGE, ROUTING_KEY, QUEUE_NAME, (message) =>
      this.handleAiCompleted(message as AiCompletedMessage),
    );
  }

  private async handleAiCompleted(message: AiCompletedMessage): Promise<void> {
    this.structuredLogger.info(
      {
        ...getTraceContext(),
        event_type: ROUTING_KEY,
        step: "consume",
        eventId: message.eventId,
        tenantId: message.tenantId,
      },
      "[notification-service]: Consumed event.ai.completed",
    );
    // DEMO BREAKPOINT: after consuming event.ai.completed
    const eventContext: Record<string, unknown> = {
      type: message.type,
      source: message.source,
      tenantId: message.tenantId,
      ...message.payload,
    };

    const aiAnalysis: AiAnalysisSummary = {
      summary: message.summary,
      category: message.category,
      severity: message.severity,
      businessImpact: message.businessImpact,
      recommendation: message.recommendation,
      recommendedChannel: message.recommendedChannel,
      isDuplicate: message.isDuplicate,
      duplicateOfEventId: message.duplicateOfEventId,
    };

    try {
      for (const match of message.matches) {
        await this.notificationsService.createFromMatch(
          message.tenantId,
          message.eventId,
          match.ruleId,
          match.ruleName,
          match.actions,
          eventContext,
          aiAnalysis,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to create notifications for event ${message.eventId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.publishAudit(message, err);
      throw err;
    }
  }

  private async publishAudit(message: AiCompletedMessage, err: unknown): Promise<void> {
    try {
      await this.rabbitmq.publish(EXCHANGE, AUDIT_CREATED_ROUTING_KEY, {
        tenantId: message.tenantId,
        actorId: null,
        action: "event.notification.failed",
        targetType: "event",
        targetId: message.eventId,
        metadata: {
          type: message.type,
          stage: "notification",
          error: err instanceof Error ? err.message : String(err),
        },
      });
    } catch (auditErr) {
      this.logger.error(
        `Failed to publish audit.created for event ${message.eventId}: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`,
      );
    }
  }
}
