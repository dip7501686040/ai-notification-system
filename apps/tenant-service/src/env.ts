import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  PORT: z.coerce.number().default(8002),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = loadEnv(schema);
