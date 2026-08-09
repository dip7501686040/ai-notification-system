import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import { getTraceContext } from "@ai-notification/telemetry";
import type { Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { RulesService } from "./rules.service";
import { evaluate, type Condition } from "./rule-evaluator";

const EVENTS_EXCHANGE = "platform";
const EVENT_CREATED_ROUTING_KEY = "event.created";
const RULE_MATCHED_ROUTING_KEY = "event.rule.matched";
const AUDIT_CREATED_ROUTING_KEY = "audit.created";
const QUEUE_NAME = "rule-engine.event.created";

interface EventCreatedMessage {
  eventId: string;
  tenantId: string;
  type: string;
  source?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface RuleMatchEntry {
  ruleId: string;
  ruleName: string;
  actions: unknown;
}

// The first RabbitMQ *consumer* in this codebase (everything before this
// only published). Subscribes to every event-service publishes and
// evaluates each tenant's active rules against it. Pipeline stage 1 of
// event.created -> event.rule.matched -> event.ai.completed ->
// notification.created: one event.rule.matched is published per event
// (carrying every matching rule), not one per rule, so ai-service (the
// next stage) runs exactly one analysis per event instead of one per
// matching rule.
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
    this.logger.info(
      {
        ...getTraceContext(),
        event_type: EVENT_CREATED_ROUTING_KEY,
        step: "consume",
        eventId: message.eventId,
        tenantId: message.tenantId,
      },
      "[rule-engine-service]: Consumed event.created",
    );
    // DEMO BREAKPOINT: after consuming event.created
    try {
      await this.evaluateAndPublish(message);
    } catch (err) {
      this.logger.error(
        { err, tenantId: message.tenantId, eventId: message.eventId },
        "Rule evaluation failed for event",
      );
      await this.publishAudit(message, err);
      throw err;
    }
  }

  private async evaluateAndPublish(message: EventCreatedMessage): Promise<void> {
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

    const matches: RuleMatchEntry[] = [];

    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, unknown> | null;
      const isMatch =
        !conditions || Object.keys(conditions).length === 0
          ? true
          : evaluate(conditions as unknown as Condition, context);

      if (!isMatch) {
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

      matches.push({ ruleId: rule.id, ruleName: rule.name, actions: rule.actions });
    }

    if (matches.length === 0) {
      return;
    }

    this.logger.info(
      {
        ...getTraceContext(),
        event_type: RULE_MATCHED_ROUTING_KEY,
        step: "publish",
        eventId: message.eventId,
        tenantId: message.tenantId,
      },
      "[rule-engine-service]: Publishing event.rule.matched",
    );
    // DEMO BREAKPOINT: before publishing event.rule.matched
    await this.rabbitmq.publish(EVENTS_EXCHANGE, RULE_MATCHED_ROUTING_KEY, {
      eventId: message.eventId,
      tenantId: message.tenantId,
      type: message.type,
      source: message.source,
      payload: message.payload,
      matchedAt: new Date().toISOString(),
      matches,
    });
  }

  private async publishAudit(message: EventCreatedMessage, err: unknown): Promise<void> {
    try {
      await this.rabbitmq.publish(EVENTS_EXCHANGE, AUDIT_CREATED_ROUTING_KEY, {
        tenantId: message.tenantId,
        actorId: null,
        action: "event.rule.failed",
        targetType: "event",
        targetId: message.eventId,
        metadata: {
          type: message.type,
          stage: "rule",
          error: err instanceof Error ? err.message : String(err),
        },
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, eventId: message.eventId },
        "Failed to publish audit.created for rule evaluation failure",
      );
    }
  }
}
