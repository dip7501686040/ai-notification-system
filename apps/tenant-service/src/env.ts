import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8002),
  GRPC_PORT: z.coerce.number().default(50053),
  TENANT_GRPC_PORT: z.coerce.number().default(50153),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  IDENTITY_AUTH_GRPC_ADDRESS: z.string().default("identity-service:50152"),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
});

export const env = loadEnv(schema);

export const isStripeConfigured = Boolean(env.STRIPE_SECRET_KEY);
