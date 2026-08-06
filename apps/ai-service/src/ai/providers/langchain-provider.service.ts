import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { resolveChatModel } from "./chat-model.factory";
import {
  buildAnalysisPrompt,
  type AnalysisInput,
  type AnalysisOutput,
  type LlmProvider,
} from "./llm-provider.interface";

const AnalysisSchema = z.object({
  summary: z.string(),
  category: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  businessImpact: z.enum(["low", "medium", "high"]),
  recommendation: z.string(),
  recommendedChannel: z.enum(["email", "webhook", "dashboard"]),
  isDuplicate: z.boolean(),
  duplicateOfEventId: z.string().nullable(),
});

// Single unified implementation for all three providers (Anthropic,
// OpenAI, Ollama) via LangChain's chat-model abstraction --
// withStructuredOutput() handles prompting/parsing/validation per
// provider so this class doesn't need provider-specific request/response
// shapes.
@Injectable()
export class LangchainProvider implements LlmProvider {
  async analyze(input: AnalysisInput, provider: string, model: string): Promise<AnalysisOutput> {
    const chatModel = resolveChatModel(provider, model);
    const structured = chatModel.withStructuredOutput<AnalysisOutput>(AnalysisSchema, {
      name: "event_analysis",
    });
    return await structured.invoke(buildAnalysisPrompt(input));
  }
}
