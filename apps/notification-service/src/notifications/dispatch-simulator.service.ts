import { Injectable } from "@nestjs/common";
import { createLogger } from "@ai-notification/logger";

const logger = createLogger("notification-service");

export interface DispatchResult {
  success: boolean;
  error?: string;
}

// No real Channel Service exists yet -- this simulates dispatch instead of
// integrating a real email/Slack/SMS provider, matching how identity-service
// logs its password-reset token instead of emailing it (no SMTP configured
// in this environment). A target containing "fail" (case-insensitive)
// deterministically simulates a delivery failure, so the retry/dead-letter
// path is actually exercisable in verification rather than just theoretical.
@Injectable()
export class DispatchSimulatorService {
  async dispatch(channel: string, target: string, payload: unknown): Promise<DispatchResult> {
    if (target.toLowerCase().includes("fail")) {
      const error = `Simulated delivery failure for channel "${channel}" target "${target}"`;
      logger.warn({ channel, target, payload }, error);
      return { success: false, error };
    }

    logger.info({ channel, target, payload }, `Simulated dispatch via ${channel} to ${target}`);
    return { success: true };
  }
}
