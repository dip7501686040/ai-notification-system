import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8002),
  GRPC_PORT: z.coerce.number().default(50053),
  TENANT_GRPC_PORT: z.coerce.number().default(50153),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  IDENTITY_AUTH_GRPC_ADDRESS: z.string().default("identity-service:50152"),
});

export const env = loadEnv(schema);
