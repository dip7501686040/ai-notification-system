import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../env";
import type { RecentSimilarEvent } from "../providers/llm-provider.interface";
import { EmbeddingsService } from "./embeddings.service";
import { cosineSimilarity } from "./cosine-similarity";

// RAG-based duplicate-incident retrieval: rather than filtering candidate
// past events by an exact `type` string match, this embeds the new
// event's description and every recent candidate's summary, then keeps
// only the ones that are actually semantically similar -- catches the
// same underlying incident even when it's reported under a different
// event type/wording, and excludes same-type events that aren't actually
// related.
@Injectable()
export class SimilarEventRetrieverService {
  private readonly logger = new Logger(SimilarEventRetrieverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async findSimilar(tenantId: string, queryText: string): Promise<RecentSimilarEvent[]> {
    const candidates = await this.prisma.eventAnalysis.findMany({
      where: {
        tenantId,
        status: "completed",
        createdAt: { gte: new Date(Date.now() - env.DUPLICATE_LOOKBACK_MINUTES * 60_000) },
      },
      orderBy: { createdAt: "desc" },
      take: env.RAG_CANDIDATE_LIMIT,
    });

    if (candidates.length === 0) {
      return [];
    }

    try {
      const [queryVector, candidateVectors] = await Promise.all([
        this.embeddingsService.embedQuery(queryText),
        this.embeddingsService.embedDocuments(candidates.map((candidate) => candidate.summary)),
      ]);

      return candidates
        .map((candidate, index) => ({
          candidate,
          score: cosineSimilarity(queryVector, candidateVectors[index] ?? []),
        }))
        .filter((entry) => entry.score >= env.RAG_SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, env.RAG_TOP_K)
        .map(({ candidate }) => ({
          eventId: candidate.eventId,
          summary: candidate.summary,
          createdAt: candidate.createdAt.toISOString(),
        }));
    } catch (error) {
      // Retrieval is a best-effort prompt enrichment -- if the embedding
      // model isn't reachable/pulled yet, fall back to no similar-event
      // context rather than failing the whole analysis over it.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`RAG similarity lookup failed for tenant ${tenantId}: ${message}`);
      return [];
    }
  }
}
