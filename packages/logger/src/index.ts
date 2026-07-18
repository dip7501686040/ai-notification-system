import pino, { type Logger } from "pino";

export type { Logger } from "pino";

export interface CreateLoggerOptions {
  level?: string;
  pretty?: boolean;
}

export function createLogger(service: string, options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? process.env.LOG_LEVEL ?? "info";
  const pretty = options.pretty ?? process.env.NODE_ENV !== "production";

  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: pretty
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        }
      : undefined,
  });
}
