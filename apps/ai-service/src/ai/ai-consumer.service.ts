import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
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
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly aiAnalysisService: AiAnalysisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(EVENTS_EXCHANGE, RULE_MATCHED_ROUTING_KEY, QUEUE_NAME, (message) =>
      this.aiAnalysisService.analyzeEvent(message as EventCreatedMessage),
    );
  }
}
