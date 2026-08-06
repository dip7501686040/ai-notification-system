import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  GRPC_PORT: z.coerce.number().default(50057),
  NOTIFICATION_GRPC_PORT: z.coerce.number().default(50157),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
  TEMPLATE_GRPC_ADDRESS: z.string().default("template-service:50159"),
  RETRY_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  MAX_ATTEMPTS: z.coerce.number().default(3),
});

export const env = loadEnv(schema);
