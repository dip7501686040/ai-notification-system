import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8003),
  GRPC_PORT: z.coerce.number().default(50054),
  EVENT_GRPC_PORT: z.coerce.number().default(50154),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  IDENTITY_AUTH_GRPC_ADDRESS: z.string().default("identity-service:50152"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
});

export const env = loadEnv(schema);
