import { loadEnv, z } from "@ai-notification/config";

const schema = z.object({
  GRPC_PORT: z.coerce.number().default(50055),
  AI_GRPC_PORT: z.coerce.number().default(50155),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@rabbitmq:5672"),
  TENANT_GRPC_ADDRESS: z.string().default("tenant-service:50153"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  OLLAMA_BASE_URL: z.string().default("http://ollama:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:0.5b"),
  DEFAULT_AI_PROVIDER: z.enum(["anthropic", "openai", "ollama"]).default("openai"),
  DUPLICATE_LOOKBACK_MINUTES: z.coerce.number().default(60),
  // RAG duplicate-detection retrieval (embeddings always run locally via
  // Ollama, independent of which provider does the analysis itself).
  EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  RAG_CANDIDATE_LIMIT: z.coerce.number().default(50),
  RAG_TOP_K: z.coerce.number().default(5),
  // Comparing a new event's raw description against a stored LLM-generated
  // summary (different "registers" of text) scores lower than same-register
  // comparisons -- empirically ~0.72 for a genuine duplicate vs ~0.56 for an
  // unrelated event with nomic-embed-text, so 0.75 was too strict.
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().default(0.65),
});

export const env = loadEnv(schema);
