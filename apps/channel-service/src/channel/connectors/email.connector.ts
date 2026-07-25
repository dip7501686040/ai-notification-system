import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import { env } from "../../env";
import type { ChannelConnector, DispatchResult } from "./connector.interface";

function isRenderedPayload(payload: unknown): payload is { subject: string; body: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { subject?: unknown }).subject === "string" &&
    typeof (payload as { body?: unknown }).body === "string"
  );
}

@Injectable()
export class EmailConnector implements ChannelConnector {
  async dispatch(target: string, payload: unknown): Promise<DispatchResult> {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      return { success: false, error: "Email channel not configured" };
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });

    const fromAddress = env.SMTP_FROM || env.SMTP_USER;
    const from = env.SMTP_FROM_NAME ? `"${env.SMTP_FROM_NAME}" <${fromAddress}>` : fromAddress;

    // Rendered templates (Template Service) hand us {subject, body}
    // directly; anything else (no template configured, or one that
    // doesn't exist) falls back to pretty-printing the flattened event
    // context notification-service sends instead.
    const subject = isRenderedPayload(payload)
      ? payload.subject
      : "Notification from AI Notification Platform";
    const text = isRenderedPayload(payload) ? payload.body : JSON.stringify(payload, null, 2);

    await transporter.sendMail({ from, to: target, subject, text });

    return { success: true };
  }
}
