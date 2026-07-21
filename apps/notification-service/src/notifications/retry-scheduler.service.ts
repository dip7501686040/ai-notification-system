import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { env } from "../env";

// In-process interval poller rather than a Redis/BullMQ-backed job queue --
// Redis is provisioned in docker-compose but nothing uses it yet, and a
// full job-queue dependency is more than this pass's scope needs. Mirrors
// RabbitMQService's own hand-rolled setTimeout reconnect loop in spirit.
@Injectable()
export class RetrySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RetrySchedulerService.name);
  private isRunning = false;

  constructor(private readonly notificationsService: NotificationsService) {}

  onModuleInit(): void {
    setInterval(() => {
      void this.poll();
    }, env.RETRY_POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      const due = await this.notificationsService.findDueForRetry();
      for (const notification of due) {
        await this.notificationsService.attemptDispatch(notification);
      }
    } catch (error) {
      this.logger.error(`Retry poll failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.isRunning = false;
    }
  }
}
