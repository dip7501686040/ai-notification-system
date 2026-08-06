import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  GRPC_PORT: z.coerce.number().default(50058),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  RETRY_BACKOFF_MS: z.string().default("10000,30000,60000"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
});

export const env = loadEnv(schema);
