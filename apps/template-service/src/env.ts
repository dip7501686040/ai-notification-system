import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  GRPC_PORT: z.coerce.number().default(50059),
  TEMPLATE_GRPC_PORT: z.coerce.number().default(50159),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
});

export const env = loadEnv(schema);
