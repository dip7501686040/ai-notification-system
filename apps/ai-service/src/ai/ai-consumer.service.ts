import { Injectable, type OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { AiAnalysisService, type EventCreatedMessage } from "./ai-analysis.service";

const EVENTS_EXCHANGE = "platform";
const EVENT_CREATED_ROUTING_KEY = "event.created";
const QUEUE_NAME = "ai-service.event.created";

// Second independent consumer of event.created (alongside
// rule-consumer.service.ts) -- the platform exchange fans the same
// routing key out to both queues, each getting its own copy.
@Injectable()
export class AiConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly aiAnalysisService: AiAnalysisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume(EVENTS_EXCHANGE, EVENT_CREATED_ROUTING_KEY, QUEUE_NAME, (message) =>
      this.aiAnalysisService.analyzeEvent(message as EventCreatedMessage),
    );
  }
}
