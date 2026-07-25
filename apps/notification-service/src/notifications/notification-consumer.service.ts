import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { NotificationsService } from "./notifications.service";

const EXCHANGE = "platform";
const ROUTING_KEY = "event.rule.matched";
const QUEUE_NAME = "notification-service.event.rule.matched";

interface RuleMatchedMessage {
  eventId: string;
  tenantId: string;
  ruleId: string;
  ruleName: string;
  actions: unknown;
  type: string;
  source?: string;
  payload: Record<string, unknown>;
  matchedAt: string;
}

// Second RabbitMQ consumer in the codebase (after rule-engine-service's).
// Turns each matched rule's actions into tracked Notification rows.
@Injectable()
export class NotificationConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(EXCHANGE, ROUTING_KEY, QUEUE_NAME, (message) =>
      this.handleMatch(message as RuleMatchedMessage),
    );
  }

  private async handleMatch(message: RuleMatchedMessage): Promise<void> {
    await this.notificationsService.createFromMatch(
      message.tenantId,
      message.eventId,
      message.ruleId,
      message.actions,
      {
        type: message.type,
        source: message.source,
        tenantId: message.tenantId,
        ...message.payload,
      },
    );
  }
}
