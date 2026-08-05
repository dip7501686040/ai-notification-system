import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  GRPC_PORT: z.coerce.number().default(50060),
  ANALYTICS_GRPC_PORT: z.coerce.number().default(50160),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
  // Browser-facing, not the docker-network hostnames -- these get embedded
  // as iframe src URLs in the tenant's browser, so they must be reachable
  // from outside the compose network.
  GRAFANA_PUBLIC_URL: z.string().default("http://localhost:3011"),
  JAEGER_PUBLIC_URL: z.string().default("http://localhost:16686"),
  // Estimated cost per notification sent on a given channel -- an
  // explicit estimate, not real billing, since no cost/pricing concept
  // exists anywhere else in the codebase.
  CHANNEL_COST_JSON: z.string().default('{"email":0.0001,"webhook":0,"dashboard":0}'),
});

export const env = loadEnv(schema);

export const channelCost: Record<string, number> = JSON.parse(env.CHANNEL_COST_JSON);
