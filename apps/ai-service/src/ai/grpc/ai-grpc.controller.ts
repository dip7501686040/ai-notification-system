import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import type { RawListQuery } from "@ai-notification/common";
import type { EventAnalysis } from "../../../generated/prisma-client";
import { AiAnalysisService } from "../ai-analysis.service";
import { AiConfigService } from "../ai-config.service";

interface EventAnalysisMessage {
  id: string;
  tenant_id: string;
  event_id: string;
  type: string;
  provider: string;
  model: string;
  summary: string;
  category: string;
  severity: string;
  business_impact: string;
  recommendation: string;
  is_duplicate: boolean;
  duplicate_of_event_id: string;
  status: string;
  error: string;
  created_at: string;
  updated_at: string;
  recommended_channel: string;
}

interface ListQueryMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListEventAnalysesRequest {
  requester_id: string;
  tenant_id: string;
  query: ListQueryMessage;
}

interface ListEventAnalysesResponse {
  list: EventAnalysisMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface GetEventAnalysisRequest {
  requester_id: string;
  analysis_id: string;
}

interface GetEventAnalysisByEventRequest {
  requester_id: string;
  event_id: string;
}

interface AiConfigMessage {
  tenant_id: string;
  provider: string;
  model: string;
}

interface GetAiConfigRequest {
  requester_id: string;
  tenant_id: string;
}

interface SetAiConfigRequest {
  requester_id: string;
  tenant_id: string;
  provider: string;
  model: string;
}

function toEventAnalysisMessage(analysis: EventAnalysis): EventAnalysisMessage {
  return {
    id: analysis.id,
    tenant_id: analysis.tenantId,
    event_id: analysis.eventId,
    type: analysis.type,
    provider: analysis.provider,
    model: analysis.model,
    summary: analysis.summary,
    category: analysis.category,
    severity: analysis.severity,
    business_impact: analysis.businessImpact,
    recommendation: analysis.recommendation,
    is_duplicate: analysis.isDuplicate,
    duplicate_of_event_id: analysis.duplicateOfEventId ?? "",
    status: analysis.status,
    error: analysis.error ?? "",
    created_at: analysis.createdAt.toISOString(),
    updated_at: analysis.updatedAt.toISOString(),
    recommended_channel: analysis.recommendedChannel,
  };
}

function toRawListQuery(query: ListQueryMessage | undefined): RawListQuery {
  return {
    page: query?.page || undefined,
    limit: query?.limit || undefined,
    search: query?.search || undefined,
    sort_fields: query?.sort_fields || undefined,
    sort_type: query?.sort_type || undefined,
  };
}

@Controller()
export class AiGrpcController {
  constructor(
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly aiConfigService: AiConfigService,
  ) {}

  @GrpcMethod("AiAnalysis", "ListEventAnalyses")
  async listEventAnalyses(data: ListEventAnalysesRequest): Promise<ListEventAnalysesResponse> {
    const result = await this.aiAnalysisService.findAllForTenant(
      data.tenant_id,
      data.requester_id,
      toRawListQuery(data.query),
    );
    return {
      list: result.list.map(toEventAnalysisMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("AiAnalysis", "GetEventAnalysis")
  async getEventAnalysis(data: GetEventAnalysisRequest): Promise<EventAnalysisMessage> {
    const analysis = await this.aiAnalysisService.findOne(data.analysis_id, data.requester_id);
    return toEventAnalysisMessage(analysis);
  }

  @GrpcMethod("AiAnalysis", "GetEventAnalysisByEvent")
  async getEventAnalysisByEvent(
    data: GetEventAnalysisByEventRequest,
  ): Promise<EventAnalysisMessage> {
    const analysis = await this.aiAnalysisService.findOneByEvent(data.event_id, data.requester_id);
    return toEventAnalysisMessage(analysis);
  }

  @GrpcMethod("AiAnalysis", "GetAiConfig")
  async getAiConfig(data: GetAiConfigRequest): Promise<AiConfigMessage> {
    const config = await this.aiConfigService.getConfig(data.tenant_id, data.requester_id);
    return { tenant_id: data.tenant_id, provider: config.provider, model: config.model };
  }

  @GrpcMethod("AiAnalysis", "SetAiConfig")
  async setAiConfig(data: SetAiConfigRequest): Promise<AiConfigMessage> {
    const config = await this.aiConfigService.setConfig(
      data.tenant_id,
      data.requester_id,
      data.provider,
      data.model,
    );
    return { tenant_id: data.tenant_id, provider: config.provider, model: config.model };
  }
}
