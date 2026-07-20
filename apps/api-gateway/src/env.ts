import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8000),
  GRPC_PORT: z.coerce.number().default(50051),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  IDENTITY_AUTH_GRPC_ADDRESS: z.string().default("identity-service:50152"),
});

export const env = loadEnv(schema);
