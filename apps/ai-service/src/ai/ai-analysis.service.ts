import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import type { EventAnalysis, Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { AiConfigService } from "./ai-config.service";
import { LangchainProvider } from "./providers/langchain-provider.service";
import type { AnalysisInput } from "./providers/llm-provider.interface";
import { SimilarEventRetrieverService } from "./rag/similar-event-retriever.service";
import { env } from "../env";

const ANALYSIS_SEARCHABLE_FIELDS = ["type", "category", "severity", "businessImpact", "status"];
const EXCHANGE = "platform";
const AI_COMPLETED_ROUTING_KEY = "event.ai.completed";

export interface EventCreatedMessage {
  eventId: string;
  tenantId: string;
  type: string;
  source?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class AiAnalysisService extends BaseCrudService<
  EventAnalysis,
  Prisma.EventAnalysisCreateInput,
  Prisma.EventAnalysisUpdateInput,
  Prisma.EventAnalysisWhereUniqueInput,
  Prisma.EventAnalysisWhereInput,
  Prisma.EventAnalysisOrderByWithRelationInput
> {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
    private readonly aiConfig: AiConfigService,
    private readonly langchainProvider: LangchainProvider,
    private readonly similarEventRetriever: SimilarEventRetrieverService,
  ) {
    super(prisma.eventAnalysis);
  }

  async analyzeEvent(message: EventCreatedMessage): Promise<void> {
    const { provider, model } = await this.aiConfig.getEffectiveConfig(message.tenantId);

    try {
      // RAG: retrieve past events that are semantically similar to this
      // one (not just same event `type`) to ground the LLM's duplicate
      // and business-impact judgment in the tenant's actual recent
      // history, rather than deciding from the raw event alone.
      const queryText = `${message.type} ${message.source ?? ""} ${JSON.stringify(message.payload)}`;
      const recentSimilar = await this.similarEventRetriever.findSimilar(
        message.tenantId,
        queryText,
      );

      const input: AnalysisInput = {
        eventType: message.type,
        eventSource: message.source,
        payload: message.payload,
        recentSimilar,
      };

      const result = await this.langchainProvider.analyze(input, provider, model);

      const analysis = await super.create({
        tenantId: message.tenantId,
        eventId: message.eventId,
        type: message.type,
        provider,
        model,
        summary: result.summary,
        category: result.category,
        severity: result.severity,
        businessImpact: result.businessImpact,
        recommendation: result.recommendation,
        isDuplicate: result.isDuplicate,
        duplicateOfEventId: result.duplicateOfEventId,
        status: "completed",
      });

      await this.rabbitmq.publish(EXCHANGE, AI_COMPLETED_ROUTING_KEY, {
        analysisId: analysis.id,
        tenantId: analysis.tenantId,
        eventId: analysis.eventId,
        provider: analysis.provider,
        model: analysis.model,
        summary: analysis.summary,
        category: analysis.category,
        severity: analysis.severity,
        businessImpact: analysis.businessImpact,
        recommendation: analysis.recommendation,
        isDuplicate: analysis.isDuplicate,
        duplicateOfEventId: analysis.duplicateOfEventId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `AI analysis failed for event ${message.eventId} (tenant ${message.tenantId}, provider ${provider}): ${errorMessage}`,
      );
      await super.create({
        tenantId: message.tenantId,
        eventId: message.eventId,
        type: message.type,
        provider,
        model,
        summary: "",
        category: "",
        severity: "low",
        businessImpact: "low",
        recommendation: "",
        isDuplicate: false,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  async findAllForTenant(
    tenantId: string,
    requesterId: string,
    query: RawListQuery,
  ): Promise<Paginated<EventAnalysis>> {
    await this.assertMembership(tenantId, requesterId);
    return this.list(query, { searchableFields: ANALYSIS_SEARCHABLE_FIELDS }, { tenantId });
  }

  async findOne(analysisId: string, requesterId: string): Promise<EventAnalysis> {
    const analysis = await this.getAnalysisOrThrow({ id: analysisId });
    await this.assertMembership(analysis.tenantId, requesterId, true);
    return analysis;
  }

  async findOneByEvent(eventId: string, requesterId: string): Promise<EventAnalysis> {
    const analysis = await this.prisma.eventAnalysis.findFirst({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });
    if (!analysis) {
      throw new NotFoundException("Event analysis not found");
    }
    await this.assertMembership(analysis.tenantId, requesterId, true);
    return analysis;
  }

  private async getAnalysisOrThrow(
    where: Prisma.EventAnalysisWhereUniqueInput,
  ): Promise<EventAnalysis> {
    const analysis = await this.findUnique(where);
    if (!analysis) {
      throw new NotFoundException("Event analysis not found");
    }
    return analysis;
  }

  // notFoundOnFailure mirrors every other service's findOne: a 403 would
  // confirm the analysis exists to callers who aren't tenant members, so
  // single-analysis reads 404 instead.
  private async assertMembership(
    tenantId: string,
    requesterId: string,
    notFoundOnFailure = false,
  ): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      if (notFoundOnFailure) {
        throw new NotFoundException("Event analysis not found");
      }
      throw new ForbiddenException("Not a member of this tenant");
    }
  }
}
