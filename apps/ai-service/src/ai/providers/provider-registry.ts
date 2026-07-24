import { env } from "../../env";

// "ollama" runs locally with no API key -- it's always considered
// configured as far as the platform is concerned (a stopped/unreachable
// Ollama server surfaces as an ordinary runtime failure, same as any other
// provider error).
export const SUPPORTED_PROVIDERS = ["anthropic", "openai", "ollama"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

export function isProviderConfigured(provider: SupportedProvider): boolean {
  if (provider === "anthropic") {
    return Boolean(env.ANTHROPIC_API_KEY);
  }
  if (provider === "openai") {
    return Boolean(env.OPENAI_API_KEY);
  }
  return true;
}

export function defaultModelFor(provider: SupportedProvider): string {
  if (provider === "anthropic") {
    return env.ANTHROPIC_MODEL;
  }
  if (provider === "openai") {
    return env.OPENAI_MODEL;
  }
  return env.OLLAMA_MODEL;
}
