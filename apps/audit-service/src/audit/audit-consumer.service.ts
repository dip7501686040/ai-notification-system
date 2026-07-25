import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import type { Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";

const EXCHANGE = "platform";
const AUDIT_CREATED_ROUTING_KEY = "audit.created";
const NOTIFICATION_SENT_ROUTING_KEY = "notification.sent";
const AI_COMPLETED_ROUTING_KEY = "event.ai.completed";
const AUDIT_CREATED_QUEUE = "audit.audit.created";
const NOTIFICATION_SENT_QUEUE = "audit.notification.sent";
const AI_COMPLETED_QUEUE = "audit.event.ai.completed";

// Generic event -- already shaped exactly as an AuditLog row needs, by
// whichever service published it (rule-engine-service's rule CRUD,
// identity-service's login). Written as-is, no mapping needed.
interface AuditCreatedMessage {
  tenantId: string | null;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

interface NotificationSentMessage {
  notificationId: string;
  tenantId: string;
  channel: string;
  target: string;
}

interface AiCompletedMessage {
  analysisId: string;
  tenantId: string;
  eventId: string;
  provider: string;
  model: string;
  category: string;
  severity: string;
  businessImpact: string;
  isDuplicate: boolean;
}

// Third/fourth/fifth consumers on the `platform` exchange rule-engine-
// service/notification-service/analytics-service already bind to.
// "Consumes every event. Completely asynchronous" (FR-9) -- fire-and-
// forget, never blocks the services it observes.
@Injectable()
export class AuditConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(
      EXCHANGE,
      AUDIT_CREATED_ROUTING_KEY,
      AUDIT_CREATED_QUEUE,
      (message) => this.handleAuditCreated(message as AuditCreatedMessage),
    );
    await this.rabbitmq.consume(
      EXCHANGE,
      NOTIFICATION_SENT_ROUTING_KEY,
      NOTIFICATION_SENT_QUEUE,
      (message) => this.handleNotificationSent(message as NotificationSentMessage),
    );
    await this.rabbitmq.consume(EXCHANGE, AI_COMPLETED_ROUTING_KEY, AI_COMPLETED_QUEUE, (message) =>
      this.handleAiCompleted(message as AiCompletedMessage),
    );
  }

  private async handleAuditCreated(message: AuditCreatedMessage): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: message.tenantId,
        actorId: message.actorId,
        action: message.action,
        targetType: message.targetType,
        targetId: message.targetId,
        metadata: (message.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async handleNotificationSent(message: NotificationSentMessage): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: message.tenantId,
        actorId: null,
        action: "notification.sent",
        targetType: "notification",
        targetId: message.notificationId,
        metadata: { channel: message.channel, target: message.target } as Prisma.InputJsonValue,
      },
    });
  }

  private async handleAiCompleted(message: AiCompletedMessage): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: message.tenantId,
        actorId: null,
        action: "ai.decision.generated",
        targetType: "analysis",
        targetId: message.analysisId,
        metadata: {
          eventId: message.eventId,
          provider: message.provider,
          model: message.model,
          category: message.category,
          severity: message.severity,
          businessImpact: message.businessImpact,
          isDuplicate: message.isDuplicate,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
