import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { env } from "../../env";
import { ProviderNotConfiguredError } from "./llm-provider.interface";
import { isProviderConfigured, isSupportedProvider } from "./provider-registry";

export function resolveChatModel(provider: string, model: string): BaseChatModel {
  if (!isSupportedProvider(provider) || !isProviderConfigured(provider)) {
    throw new ProviderNotConfiguredError(provider);
  }

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({ apiKey: env.ANTHROPIC_API_KEY, model });
    case "openai":
      return new ChatOpenAI({ apiKey: env.OPENAI_API_KEY, model });
    case "ollama":
      return new ChatOllama({ baseUrl: env.OLLAMA_BASE_URL, model });
  }
}
