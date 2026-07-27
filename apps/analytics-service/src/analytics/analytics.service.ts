import { ForbiddenException, Injectable } from "@nestjs/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import { PrismaService } from "../prisma/prisma.service";
import { env, channelCost } from "../env";

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

const DEFAULT_DAYS = 30;
const DEFAULT_TOP_SOURCES_LIMIT = 10;

function trailingDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyEvents(
    tenantId: string,
    requesterId: string,
    days?: number,
  ): Promise<DailyEventCount[]> {
    await this.assertMembership(tenantId, requesterId);
    const windowDays = days && days > 0 ? days : DEFAULT_DAYS;
    const dates = trailingDates(windowDays);

    const rows = await this.prisma.dailyEventStat.groupBy({
      by: ["date"],
      where: { tenantId, date: { in: dates } },
      _sum: { count: true },
    });

    const countByDate = new Map(rows.map((row) => [row.date, row._sum.count ?? 0]));
    return dates.map((date) => ({ date, count: countByDate.get(date) ?? 0 }));
  }

  async getTopSources(
    tenantId: string,
    requesterId: string,
    days?: number,
    limit?: number,
  ): Promise<SourceCount[]> {
    await this.assertMembership(tenantId, requesterId);
    const windowDays = days && days > 0 ? days : DEFAULT_DAYS;
    const topLimit = limit && limit > 0 ? limit : DEFAULT_TOP_SOURCES_LIMIT;
    const dates = trailingDates(windowDays);

    const rows = await this.prisma.dailyEventStat.groupBy({
      by: ["source"],
      where: { tenantId, date: { in: dates } },
      _sum: { count: true },
    });

    return rows
      .map((row) => ({ source: row.source || "unknown", count: row._sum.count ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topLimit);
  }

  async getNotificationStats(
    tenantId: string,
    requesterId: string,
    days?: number,
  ): Promise<NotificationStats> {
    await this.assertMembership(tenantId, requesterId);
    const windowDays = days && days > 0 ? days : DEFAULT_DAYS;
    const dates = trailingDates(windowDays);

    const rows = await this.prisma.dailyNotificationStat.groupBy({
      by: ["channel"],
      where: { tenantId, date: { in: dates } },
      _sum: { sent: true, failed: true },
    });

    const byChannel: ChannelNotificationStats[] = rows.map((row) => {
      const sent = row._sum.sent ?? 0;
      const failed = row._sum.failed ?? 0;
      const rate = channelCost[row.channel] ?? 0;
      return { channel: row.channel, sent, failed, estimatedCost: sent * rate };
    });

    const totalSent = byChannel.reduce((sum, c) => sum + c.sent, 0);
    const totalFailed = byChannel.reduce((sum, c) => sum + c.failed, 0);
    const totalEstimatedCost = byChannel.reduce((sum, c) => sum + c.estimatedCost, 0);
    const successRate = totalSent + totalFailed > 0 ? totalSent / (totalSent + totalFailed) : 0;

    return { byChannel, totalSent, totalFailed, successRate, totalEstimatedCost };
  }

  // Builds Grafana/Jaeger embed URLs with tenantId baked in server-side
  // (only after the membership check below) -- the frontend just renders
  // these in an iframe, it never constructs or edits the tenant_id itself.
  async getObservabilityLinks(tenantId: string, requesterId: string): Promise<ObservabilityLinks> {
    await this.assertMembership(tenantId, requesterId);

    const encodedTenantId = encodeURIComponent(tenantId);
    const tracesTags = encodeURIComponent(JSON.stringify({ "tenant.id": tenantId }));

    return {
      metricsLogsUrl: `${env.GRAFANA_PUBLIC_URL}/d/tenant-observability/tenant-observability?var-tenant_id=${encodedTenantId}&kiosk`,
      // service=api-gateway: that's where TenantMetricsInterceptor tags
      // the root span with tenant.id, so it's always the right service
      // to search on regardless of which downstream service the request
      // eventually touched.
      tracesUrl: `${env.JAEGER_PUBLIC_URL}/search?service=api-gateway&tags=${tracesTags}`,
      systemHealthUrl: `${env.GRAFANA_PUBLIC_URL}/d/platform-health/platform-health?kiosk`,
    };
  }

  // No notFoundOnFailure variant needed here (unlike every other
  // service's single-resource reads) -- these are aggregate/tenant-scoped
  // queries, not lookups by an opaque ID that would otherwise leak
  // existence to non-members.
  private async assertMembership(tenantId: string, requesterId: string): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      throw new ForbiddenException("Not a member of this tenant");
    }
  }
}
