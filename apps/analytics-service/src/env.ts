import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8009),
  GRPC_PORT: z.coerce.number().default(50060),
  ANALYTICS_GRPC_PORT: z.coerce.number().default(50160),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
  // Estimated cost per notification sent on a given channel -- an
  // explicit estimate, not real billing, since no cost/pricing concept
  // exists anywhere else in the codebase.
  CHANNEL_COST_JSON: z.string().default('{"email":0.0001,"webhook":0,"dashboard":0}'),
});

export const env = loadEnv(schema);

export const channelCost: Record<string, number> = JSON.parse(env.CHANNEL_COST_JSON);
