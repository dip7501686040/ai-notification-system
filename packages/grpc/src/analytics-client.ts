import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface DailyEventCount {
  date: string;
  count: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface ChannelNotificationStats {
  channel: string;
  sent: number;
  failed: number;
  estimatedCost: number;
}

export interface NotificationStats {
  byChannel: ChannelNotificationStats[];
  totalSent: number;
  totalFailed: number;
  successRate: number;
  totalEstimatedCost: number;
}

export interface ObservabilityLinks {
  metricsLogsUrl: string;
  tracesUrl: string;
  systemHealthUrl: string;
}

interface DailyEventCountWireMessage {
  date: string;
  count: number;
}

interface GetDailyEventsWireResponse {
  list: DailyEventCountWireMessage[];
}

interface SourceCountWireMessage {
  source: string;
  count: number;
}

interface GetTopSourcesWireResponse {
  list: SourceCountWireMessage[];
}

interface ChannelStatWireMessage {
  channel: string;
  sent: number;
  failed: number;
  estimated_cost: number;
}

interface GetNotificationStatsWireResponse {
  by_channel: ChannelStatWireMessage[];
  total_sent: number;
  total_failed: number;
  success_rate: number;
  total_estimated_cost: number;
}

interface GetObservabilityLinksWireResponse {
  metrics_logs_url: string;
  traces_url: string;
  system_health_url: string;
}

function createClient(address: string): grpc.Client {
  const proto = loadProto("analytics.proto") as unknown as {
    analytics: { v1: { Analytics: grpc.ServiceClientConstructor } };
  };
  return new proto.analytics.v1.Analytics(address, grpc.credentials.createInsecure());
}

export async function getDailyEventsViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  days?: number,
): Promise<DailyEventCount[]> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; days: number },
      GetDailyEventsWireResponse
    >(client, "GetDailyEvents", {
      requester_id: requesterId,
      tenant_id: tenantId,
      days: days ?? 0,
    });
    return response.list;
  } finally {
    client.close();
  }
}

export async function getTopSourcesViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  days?: number,
  limit?: number,
): Promise<SourceCount[]> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; days: number; limit: number },
      GetTopSourcesWireResponse
    >(client, "GetTopSources", {
      requester_id: requesterId,
      tenant_id: tenantId,
      days: days ?? 0,
      limit: limit ?? 0,
    });
    return response.list;
  } finally {
    client.close();
  }
}

export async function getNotificationStatsViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  days?: number,
): Promise<NotificationStats> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; days: number },
      GetNotificationStatsWireResponse
    >(client, "GetNotificationStats", {
      requester_id: requesterId,
      tenant_id: tenantId,
      days: days ?? 0,
    });
    return {
      byChannel: response.by_channel.map((c) => ({
        channel: c.channel,
        sent: c.sent,
        failed: c.failed,
        estimatedCost: c.estimated_cost,
      })),
      totalSent: response.total_sent,
      totalFailed: response.total_failed,
      successRate: response.success_rate,
      totalEstimatedCost: response.total_estimated_cost,
    };
  } finally {
    client.close();
  }
}

export async function getObservabilityLinksViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
): Promise<ObservabilityLinks> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string },
      GetObservabilityLinksWireResponse
    >(client, "GetObservabilityLinks", {
      requester_id: requesterId,
      tenant_id: tenantId,
    });
    return {
      metricsLogsUrl: response.metrics_logs_url,
      tracesUrl: response.traces_url,
      systemHealthUrl: response.system_health_url,
    };
  } finally {
    client.close();
  }
}
