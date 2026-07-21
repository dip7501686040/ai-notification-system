import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8001),
  GRPC_PORT: z.coerce.number().default(50052),
  AUTH_GRPC_PORT: z.coerce.number().default(50152),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default("1h"),
});

export const env = loadEnv(schema);
