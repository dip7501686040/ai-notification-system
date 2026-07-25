import { Injectable, Logger } from "@nestjs/common";
import type { DispatchResult } from "./connectors/connector.interface";
import { EmailConnector } from "./connectors/email.connector";
import { WebhookConnector } from "./connectors/webhook.connector";

// Slack/Teams/Discord/SMS/WhatsApp/Push are a named cut for this pass --
// no credentials, no plan to fake them. Anything other than email/webhook
// gets a clean "not supported" result instead of a stub pretending to work.
@Injectable()
export class ChannelDispatchService {
  private readonly logger = new Logger(ChannelDispatchService.name);

  constructor(
    private readonly emailConnector: EmailConnector,
    private readonly webhookConnector: WebhookConnector,
  ) {}

  async dispatch(channel: string, target: string, payload: unknown): Promise<DispatchResult> {
    try {
      switch (channel) {
        case "email":
          return await this.emailConnector.dispatch(target, payload);
        case "webhook":
          return await this.webhookConnector.dispatch(target, payload);
        default:
          return { success: false, error: `Channel "${channel}" is not supported` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Dispatch failed for channel "${channel}" target "${target}": ${message}`);
      return { success: false, error: message };
    }
  }
}
