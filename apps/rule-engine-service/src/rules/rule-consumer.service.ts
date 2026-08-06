import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import type { Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { RulesService } from "./rules.service";
import { evaluate, type Condition } from "./rule-evaluator";

const EVENTS_EXCHANGE = "platform";
const EVENT_CREATED_ROUTING_KEY = "event.created";
const RULE_MATCHED_ROUTING_KEY = "event.rule.matched";
const QUEUE_NAME = "rule-engine.event.created";

interface EventCreatedMessage {
  eventId: string;
  tenantId: string;
  type: string;
  source?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// The first RabbitMQ *consumer* in this codebase (everything before this
// only published). Subscribes to every event-service publishes and
// evaluates each tenant's active rules against it.
@Injectable()
export class RuleConsumerService implements OnModuleInit {
  private readonly logger = createLogger("rule-engine-service");

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly rulesService: RulesService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(EVENTS_EXCHANGE, EVENT_CREATED_ROUTING_KEY, QUEUE_NAME, (message) =>
      this.handleEvent(message as EventCreatedMessage),
    );
  }

  private async handleEvent(message: EventCreatedMessage): Promise<void> {
    const rules = await this.rulesService.findActiveForEvaluation(message.tenantId, message.type);
    if (rules.length === 0) {
      return;
    }

    const context: Record<string, unknown> = {
      type: message.type,
      source: message.source,
      tenantId: message.tenantId,
      ...message.payload,
    };

    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, unknown> | null;
      const matches =
        !conditions || Object.keys(conditions).length === 0
          ? true
          : evaluate(conditions as unknown as Condition, context);

      if (!matches) {
        continue;
      }

      await this.prisma.ruleMatch.create({
        data: {
          ruleId: rule.id,
          tenantId: rule.tenantId,
          eventId: message.eventId,
          actions: rule.actions as Prisma.InputJsonValue,
        },
      });

      // Guarded: the RuleMatch row above is already committed, and this
      // runs in a loop over every matching rule for the event -- letting
      // a publish failure throw would nack the whole message (no
      // dead-letter/requeue, see RabbitMQService.consume), silently
      // dropping every other still-unprocessed rule match for this event
      // too, not just this one.
      try {
        await this.rabbitmq.publish(EVENTS_EXCHANGE, RULE_MATCHED_ROUTING_KEY, {
          eventId: message.eventId,
          tenantId: rule.tenantId,
          ruleId: rule.id,
          ruleName: rule.name,
          actions: rule.actions,
          type: message.type,
          source: message.source,
          payload: message.payload,
          matchedAt: new Date().toISOString(),
        });

        this.logger.info(
          { tenantId: rule.tenantId, ruleId: rule.id, eventId: message.eventId },
          `Rule "${rule.name}" matched event`,
        );
      } catch (err) {
        this.logger.error(
          { err, tenantId: rule.tenantId, ruleId: rule.id, eventId: message.eventId },
          "Failed to publish rule match",
        );
      }
    }
  }
}
