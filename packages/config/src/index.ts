import { config as loadDotenv } from "dotenv";
import type { z } from "zod";

export interface LoadEnvOptions {
  path?: string;
}

export function loadEnv<Schema extends z.ZodTypeAny>(
  schema: Schema,
  options: LoadEnvOptions = {},
): z.infer<Schema> {
  loadDotenv(options.path ? { path: options.path } : undefined);

  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

export { z } from "zod";
