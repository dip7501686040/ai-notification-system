import { Injectable } from "@nestjs/common";
import type { ChannelConnector, DispatchResult } from "./connector.interface";

const TIMEOUT_MS = 8000;

@Injectable()
export class WebhookConnector implements ChannelConnector {
  async dispatch(target: string, payload: unknown): Promise<DispatchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "webhook",
          target,
          payload,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { success: false, error: `Webhook responded with HTTP ${response.status}` };
      }
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `Webhook request timed out after ${TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : String(error);
      return { success: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
