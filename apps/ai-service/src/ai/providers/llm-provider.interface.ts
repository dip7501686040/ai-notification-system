export interface RecentSimilarEvent {
  eventId: string;
  summary: string;
  createdAt: string;
}

export interface AnalysisInput {
  eventType: string;
  eventSource?: string;
  payload: Record<string, unknown>;
  recentSimilar: RecentSimilarEvent[];
}

export type Severity = "low" | "medium" | "high" | "critical";
export type BusinessImpact = "low" | "medium" | "high";

export type RecommendedChannel = "email" | "webhook" | "dashboard";

export interface AnalysisOutput {
  summary: string;
  category: string;
  severity: Severity;
  businessImpact: BusinessImpact;
  recommendation: string;
  recommendedChannel: RecommendedChannel;
  isDuplicate: boolean;
  duplicateOfEventId: string | null;
}

export interface LlmProvider {
  analyze(input: AnalysisInput, provider: string, model: string): Promise<AnalysisOutput>;
}

// Thrown when the requested provider has no API key configured on this
// deployment (or, for a supported provider, isn't reachable). Caught by
// AiAnalysisService and persisted as a "failed" EventAnalysis row instead
// of crashing the consumer.
export class ProviderNotConfiguredError extends Error {
  constructor(public readonly provider: string) {
    super(`Provider "${provider}" is not configured on this platform`);
    this.name = "ProviderNotConfiguredError";
  }
}

export function buildAnalysisPrompt(input: AnalysisInput): string {
  const recentSimilarText =
    input.recentSimilar.length > 0
      ? input.recentSimilar
          .map((event) => `- event ${event.eventId} (${event.createdAt}): ${event.summary}`)
          .join("\n")
      : "(none)";

  return [
    "You are an incident-analysis assistant for an operations/alerting platform.",
    "Analyze the following event and produce a structured assessment: a one-sentence",
    "summary, a short category label, a severity rating, the business impact, and a",
    "concrete recommended action -- phrase the recommendation as next steps the",
    "recipient can act on (what to check, who to contact, what to do next), not just a",
    "restatement of the problem. Also decide whether this event is a duplicate of an",
    "already-recorded incident, using the recently recorded similar events below as",
    "context -- if this looks like the same underlying incident as one of them, set",
    "isDuplicate to true and duplicateOfEventId to that event's id; otherwise set",
    "isDuplicate to false and duplicateOfEventId to null.",
    "",
    "Also recommend which notification channel this event should be delivered on.",
    'Choose exactly one of: "email", "webhook", "dashboard" -- these are the only',
    'channels this platform can currently deliver to. Prefer "dashboard" for routine or',
    'low-severity events, "email" for events a human should read and act on but that',
    'aren\'t time-critical, and "webhook" for events that should trigger an automated',
    "downstream system. This is advisory only -- the actual delivery channel is",
    "determined separately by the matched rule's configuration.",
    "",
    `Event type: ${input.eventType}`,
    `Event source: ${input.eventSource ?? "(unknown)"}`,
    `Event payload: ${JSON.stringify(input.payload)}`,
    "",
    "Recently recorded similar events for this tenant:",
    recentSimilarText,
  ].join("\n");
}
