import * as amqp from "amqplib";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";

export interface RabbitMQModuleOptions {
  url: string;
}

export const RABBITMQ_OPTIONS = Symbol("RABBITMQ_OPTIONS");
const RECONNECT_DELAY_MS = 5000;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;
  private readonly assertedExchanges = new Set<string>();
  private closing = false;

  constructor(@Inject(RABBITMQ_OPTIONS) private readonly options: RabbitMQModuleOptions) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    this.connection = await amqp.connect(this.options.url);

    this.connection.on("error", (error: Error) => {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
    });

    this.connection.on("close", () => {
      this.channel = undefined;
      this.assertedExchanges.clear();
      if (!this.closing) {
        this.scheduleReconnect();
      }
    });

    this.channel = await this.connection.createChannel();
    this.logger.log("RabbitMQ connected");
  }

  // A rejected connect() here must never become an unhandled rejection --
  // that crashes the whole process (Node treats it as fatal). Retries
  // itself on failure until it succeeds or the module is torn down.
  private scheduleReconnect(): void {
    if (this.closing) {
      return;
    }

    this.logger.warn(`RabbitMQ connection closed, reconnecting in ${RECONNECT_DELAY_MS}ms`);
    setTimeout(() => {
      this.connect().catch((error: Error) => {
        this.logger.error(`RabbitMQ reconnect failed: ${error.message}`);
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }

  // Publishes to a durable topic exchange, declaring it on first use per
  // exchange name (cheap no-op on the broker if it already exists with a
  // matching type/durability).
  async publish(exchange: string, routingKey: string, message: unknown): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not available");
    }

    if (!this.assertedExchanges.has(exchange)) {
      await this.channel.assertExchange(exchange, "topic", { durable: true });
      this.assertedExchanges.add(exchange);
    }

    const payload = Buffer.from(JSON.stringify(message));
    const published = this.channel.publish(exchange, routingKey, payload, {
      contentType: "application/json",
      persistent: true,
    });

    if (!published) {
      throw new Error(`RabbitMQ publish buffer full for exchange "${exchange}"`);
    }
  }
}
