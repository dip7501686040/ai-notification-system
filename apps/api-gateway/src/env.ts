import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8000),
  GRPC_PORT: z.coerce.number().default(50051),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  IDENTITY_AUTH_GRPC_ADDRESS: z.string().default("identity-service:50152"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
  EVENT_GRPC_ADDRESS: z.string().default("event-service:50154"),
  RULE_ENGINE_GRPC_ADDRESS: z.string().default("rule-engine-service:50156"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
});

export const env = loadEnv(schema);

export const isGoogleOAuthConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
