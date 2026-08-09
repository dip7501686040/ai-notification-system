import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import { getTraceContext } from "@ai-notification/telemetry";
import { AiAnalysisService, type EventCreatedMessage } from "./ai-analysis.service";

const EVENTS_EXCHANGE = "platform";
const RULE_MATCHED_ROUTING_KEY = "event.rule.matched";
const QUEUE_NAME = "ai-service.event.rule.matched";

// Pipeline stage 2: event.created -> event.rule.matched -> event.ai.completed
// -> notification.created. Runs after rule-engine-service so AI analysis
// only happens for events that actually matched a rule (worth notifying
// on), and exactly once per event rather than once per matching rule.
@Injectable()
export class AiConsumerService implements OnModuleInit {
  private readonly logger = createLogger("ai-service");

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly aiAnalysisService: AiAnalysisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(
      EVENTS_EXCHANGE,
      RULE_MATCHED_ROUTING_KEY,
      QUEUE_NAME,
      (message) => {
        const eventMessage = message as EventCreatedMessage;
        this.logger.info(
          {
            ...getTraceContext(),
            event_type: RULE_MATCHED_ROUTING_KEY,
            step: "consume",
            eventId: eventMessage.eventId,
            tenantId: eventMessage.tenantId,
          },
          "[ai-service]: Consumed event.rule.matched",
        );
        // DEMO BREAKPOINT: after consuming event.rule.matched
        return this.aiAnalysisService.analyzeEvent(eventMessage);
      },
    );
  }
}
