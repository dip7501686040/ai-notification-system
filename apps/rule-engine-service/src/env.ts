import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  GRPC_PORT: z.coerce.number().default(50056),
  RULE_ENGINE_GRPC_PORT: z.coerce.number().default(50156),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
});

export const env = loadEnv(schema);
