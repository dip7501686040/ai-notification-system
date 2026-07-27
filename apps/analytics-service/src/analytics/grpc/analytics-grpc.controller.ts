import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { AnalyticsService } from "../analytics.service";

interface GetDailyEventsRequest {
  requester_id: string;
  tenant_id: string;
  days: number;
}

interface DailyEventCountMessage {
  date: string;
  count: number;
}

interface GetDailyEventsResponse {
  list: DailyEventCountMessage[];
}

interface GetTopSourcesRequest {
  requester_id: string;
  tenant_id: string;
  days: number;
  limit: number;
}

interface SourceCountMessage {
  source: string;
  count: number;
}

interface GetTopSourcesResponse {
  list: SourceCountMessage[];
}

interface GetNotificationStatsRequest {
  requester_id: string;
  tenant_id: string;
  days: number;
}

interface ChannelStatMessage {
  channel: string;
  sent: number;
  failed: number;
  estimated_cost: number;
}

interface GetNotificationStatsResponse {
  by_channel: ChannelStatMessage[];
  total_sent: number;
  total_failed: number;
  success_rate: number;
  total_estimated_cost: number;
}

interface GetObservabilityLinksRequest {
  requester_id: string;
  tenant_id: string;
}

interface GetObservabilityLinksResponse {
  metrics_logs_url: string;
  traces_url: string;
  system_health_url: string;
}

@Controller()
export class AnalyticsGrpcController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @GrpcMethod("Analytics", "GetDailyEvents")
  async getDailyEvents(data: GetDailyEventsRequest): Promise<GetDailyEventsResponse> {
    const list = await this.analyticsService.getDailyEvents(
      data.tenant_id,
      data.requester_id,
      data.days,
    );
    return { list };
  }

  @GrpcMethod("Analytics", "GetTopSources")
  async getTopSources(data: GetTopSourcesRequest): Promise<GetTopSourcesResponse> {
    const list = await this.analyticsService.getTopSources(
      data.tenant_id,
      data.requester_id,
      data.days,
      data.limit,
    );
    return { list };
  }

  @GrpcMethod("Analytics", "GetNotificationStats")
  async getNotificationStats(
    data: GetNotificationStatsRequest,
  ): Promise<GetNotificationStatsResponse> {
    const result = await this.analyticsService.getNotificationStats(
      data.tenant_id,
      data.requester_id,
      data.days,
    );
    return {
      by_channel: result.byChannel.map((c) => ({
        channel: c.channel,
        sent: c.sent,
        failed: c.failed,
        estimated_cost: c.estimatedCost,
      })),
      total_sent: result.totalSent,
      total_failed: result.totalFailed,
      success_rate: result.successRate,
      total_estimated_cost: result.totalEstimatedCost,
    };
  }

  @GrpcMethod("Analytics", "GetObservabilityLinks")
  async getObservabilityLinks(
    data: GetObservabilityLinksRequest,
  ): Promise<GetObservabilityLinksResponse> {
    const links = await this.analyticsService.getObservabilityLinks(
      data.tenant_id,
      data.requester_id,
    );
    return {
      metrics_logs_url: links.metricsLogsUrl,
      traces_url: links.tracesUrl,
      system_health_url: links.systemHealthUrl,
    };
  }
}
