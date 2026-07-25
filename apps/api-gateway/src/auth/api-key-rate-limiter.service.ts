import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import { env } from "../env";

// Fixed-window counter per API key -- "Set Rate Limits" (FR-10). Owns its
// own redis connection (mirrors RabbitMQService's lifecycle style) rather
// than sharing the Socket.IO adapter's client, which lives in a
// different, non-injectable object.
@Injectable()
export class ApiKeyRateLimiterService implements OnModuleInit, OnModuleDestroy {
  private client!: RedisClientType;

  async onModuleInit(): Promise<void> {
    this.client = createClient({ url: env.REDIS_URL });
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  // Returns true when the request is within the limit (and counts it),
  // false once the limit for the current minute has been exceeded.
  async checkAndIncrement(apiKeyId: string, limitPerMinute: number): Promise<boolean> {
    const bucket = Math.floor(Date.now() / 60_000);
    const key = `apikey-rate:${apiKeyId}:${bucket}`;

    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, 60);
    }

    return count <= limitPerMinute;
  }
}
