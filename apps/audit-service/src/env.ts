import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8010),
  GRPC_PORT: z.coerce.number().default(50061),
  AUDIT_GRPC_PORT: z.coerce.number().default(50161),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
});

export const env = loadEnv(schema);
