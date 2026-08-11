import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc, renderTemplateViaGrpc } from "@ai-notification/grpc";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import { getTraceContext } from "@ai-notification/telemetry";
import type { Notification, Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";

const NOTIFICATION_SEARCHABLE_FIELDS = ["channel", "target", "status"];
const EXCHANGE = "platform";
const DASHBOARD_CHANNEL = "dashboard";
const NOTIFICATION_CREATED_ROUTING_KEY = "notification.created";
const NOTIFICATION_STATUS_UPDATED_ROUTING_KEY = "notification.status.updated";

interface RuleAction {
  channel: string;
  target: string;
  template?: string;
}

function isValidAction(action: unknown): action is RuleAction {
  return (
    typeof action === "object" &&
    action !== null &&
    typeof (action as RuleAction).channel === "string" &&
    typeof (action as RuleAction).target === "string"
  );
}

// ai-service's event.ai.completed payload, as much of it as
// notification-service needs to merge into each Notification's content.
export interface AiAnalysisSummary {
  summary: string;
  category: string;
  severity: string;
  businessImpact: string;
  recommendation: string;
  recommendedChannel: string;
  isDuplicate: boolean;
  duplicateOfEventId: string | null;
}

// Combines the matched rule and the AI analysis into one human-readable
// notification body -- "Rule section" / "AI section" -- so the dashboard
// (which falls back to rendering payload.subject/payload.body verbatim
// when no tenant template is configured) shows something useful without
// requiring every tenant to author a template.
function buildDefaultContent(
  ruleName: string,
  eventContext: Record<string, unknown>,
  ai: AiAnalysisSummary,
): { subject: string; body: string } {
  const eventType = eventContext.type as string;
  const subject = `[${ai.severity.toUpperCase()}] ${ruleName}: ${eventType}`;

  const duplicateLine = ai.isDuplicate ? `Yes (of event ${ai.duplicateOfEventId})` : "No";

  const body = [
    "Rule section",
    `- Rule: ${ruleName}`,
    `- Event type: ${eventType}`,
    eventContext.source ? `- Source: ${eventContext.source as string}` : undefined,
    "",
    "AI section",
    `- Summary: ${ai.summary}`,
    `- Category: ${ai.category}`,
    `- Severity: ${ai.severity}`,
    `- Business impact: ${ai.businessImpact}`,
    `- Recommended channel: ${ai.recommendedChannel}`,
    `- Duplicate: ${duplicateLine}`,
    "",
    "Next steps",
    ai.recommendation,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { subject, body };
}

@Injectable()
export class NotificationsService extends BaseCrudService<
  Notification,
  Prisma.NotificationCreateInput,
  Prisma.NotificationUpdateInput,
  Prisma.NotificationWhereUniqueInput,
  Prisma.NotificationWhereInput,
  Prisma.NotificationOrderByWithRelationInput
> {
  private readonly logger = createLogger("notification-service");

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {
    super(prisma.notification);
  }

  // actions is rule-engine-service's free-form `Rule.actions` JSON --
  // each entry is expected to be { channel: string, target: string,
  // template?: string }. Malformed entries are skipped with a warning
  // rather than failing the whole match (one bad action shouldn't drop
  // the others). eventContext is the flattened `{type, source, tenantId,
  // ...payload}` object rule-engine already builds for condition
  // evaluation -- reused here as the variable source for template
  // rendering (plus an `eventType` alias for `type`, per FR-6). aiAnalysis
  // is ai-service's completed analysis for this same event (pipeline stage
  // 2's output) -- merged into every notification's content alongside the
  // rule match, per action, so each one carries both a "Rule section" and
  // an "AI section".
  //
  // One notification per configured action, no more -- a rule with no
  // actions (or only malformed ones) produces zero notifications for this
  // match rather than an implicit fallback.
  async createFromMatch(
    tenantId: string,
    eventId: string,
    ruleId: string,
    ruleName: string,
    actions: unknown,
    eventContext: Record<string, unknown>,
    aiAnalysis: AiAnalysisSummary,
  ): Promise<void> {
    const actionList = Array.isArray(actions) ? actions : [];
    if (!Array.isArray(actions)) {
      this.logger.warn(
        { tenantId, ruleId, eventId },
        "Rule match actions is not an array -- no notification will be created for this match",
      );
    }

    const variables = {
      ...eventContext,
      eventType: eventContext.type,
      rule: { ruleId, ruleName },
      ai: aiAnalysis,
    };

    for (const action of actionList) {
      if (!isValidAction(action)) {
        this.logger.warn(
          { tenantId, ruleId, eventId, action },
          "Skipping malformed action for rule match",
        );
        continue;
      }

      await this.createAndRequestDispatch(
        tenantId,
        eventId,
        ruleId,
        ruleName,
        action.channel,
        action.target,
        action.template,
        variables,
        eventContext,
        aiAnalysis,
      );
    }
  }

  private async createAndRequestDispatch(
    tenantId: string,
    eventId: string,
    ruleId: string,
    ruleName: string,
    channel: string,
    target: string,
    template: string | undefined,
    variables: Record<string, unknown>,
    eventContext: Record<string, unknown>,
    aiAnalysis: AiAnalysisSummary,
  ): Promise<void> {
    let payload: Record<string, unknown> = {
      ...buildDefaultContent(ruleName, eventContext, aiAnalysis),
      rule: { ruleId, ruleName },
      ai: aiAnalysis,
    };
    if (template) {
      const rendered = await renderTemplateViaGrpc(
        env.TEMPLATE_GRPC_ADDRESS,
        tenantId,
        template,
        channel,
        variables,
      );
      if (rendered.found) {
        payload = { subject: rendered.subject, body: rendered.body };
      }
    }

    const notification = await super.create({
      tenantId,
      eventId,
      ruleId,
      channel,
      target,
      payload: payload as Prisma.InputJsonValue,
      status: "pending",
    });

    await this.requestDispatch(notification);
  }

  // Publishes the one event channel-service acts on to actually send a
  // notification -- used both for a brand-new row (above) and to
  // re-trigger a retry (RetrySchedulerService). notification-service never
  // calls channel-service directly: this publish is the full handoff, and
  // the row's state is only updated later, reactively, when channel-
  // service reports an outcome (see markSent/markRetrying/markDeadLetter
  // and NotificationResultConsumerService).
  async requestDispatch(notification: Notification): Promise<void> {
    try {
      this.logger.info(
        {
          ...getTraceContext(),
          event_type: NOTIFICATION_CREATED_ROUTING_KEY,
          step: "publish",
          eventId: notification.eventId,
          tenantId: notification.tenantId,
          notificationId: notification.id,
        },
        "[notification-service]: Publishing notification.created",
      );
      // DEMO BREAKPOINT: before publishing notification.created
      await this.rabbitmq.publish(EXCHANGE, NOTIFICATION_CREATED_ROUTING_KEY, {
        notificationId: notification.id,
        tenantId: notification.tenantId,
        eventId: notification.eventId,
        ruleId: notification.ruleId,
        channel: notification.channel,
        target: notification.target,
        payload: notification.payload,
        attempts: notification.attempts,
        maxAttempts: notification.maxAttempts,
      });
    } catch (err) {
      this.logger.error(
        { err, notificationId: notification.id },
        "Failed to publish notification.created",
      );
    }
  }

  // The three outcomes NotificationResultConsumerService hands back from
  // channel-service. Best-effort: an update failure here means this row's
  // status lags the real delivery outcome, which isn't worth nacking (and
  // re-delivering) the outcome event for -- there's no retry semantics for
  // "retry recording that a retry happened".
  async markSent(notificationId: string): Promise<void> {
    await this.applyOutcome(notificationId, { status: "sent", sentAt: new Date() });
  }

  async markRetrying(
    notificationId: string,
    attempts: number,
    error: string,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.applyOutcome(notificationId, {
      status: "retrying",
      attempts,
      lastError: error,
      nextAttemptAt,
    });
  }

  async markDeadLetter(notificationId: string, attempts: number, error: string): Promise<void> {
    await this.applyOutcome(notificationId, {
      status: "dead_letter",
      attempts,
      lastError: error,
    });
  }

  private async applyOutcome(
    notificationId: string,
    data: Prisma.NotificationUpdateInput,
  ): Promise<void> {
    try {
      const notification = await super.update({ id: notificationId }, data);
      await this.publishStatusUpdated(notification);
    } catch (err) {
      this.logger.error(
        { err, notificationId },
        "Failed to apply dispatch outcome to notification",
      );
    }
  }

  // Lets the dashboard reflect a status change (pending -> sent/retrying/
  // dead_letter) live instead of only on next reload -- api-gateway relays
  // this straight to the tenant's socket room under its own event name
  // (not the "new notification" one), so the frontend can quietly refetch
  // instead of toasting a status change as if it were a new notification.
  private async publishStatusUpdated(notification: Notification): Promise<void> {
    try {
      await this.rabbitmq.publish(EXCHANGE, NOTIFICATION_STATUS_UPDATED_ROUTING_KEY, {
        notificationId: notification.id,
        tenantId: notification.tenantId,
        status: notification.status,
      });
    } catch (err) {
      this.logger.error(
        { err, notificationId: notification.id },
        "Failed to publish notification.status.updated",
      );
    }
  }

  // Used by RetrySchedulerService's poll loop, not exposed over gRPC.
  async findDueForRetry(): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { status: "retrying", nextAttemptAt: { lte: new Date() } },
    });
  }

  // Claims a due row before redispatching it -- see RetrySchedulerService.
  // Moving it out of "retrying" is what stops the next poll tick (still
  // every RETRY_POLL_INTERVAL_MS) from picking the same row up again
  // before channel-service's async outcome comes back and moves it
  // somewhere else.
  async markDispatching(notification: Notification): Promise<Notification> {
    return super.update({ id: notification.id }, { status: "dispatching" });
  }

  async findAllForTenant(
    tenantId: string,
    requesterId: string,
    query: RawListQuery,
    status?: string,
    readStatus?: string,
  ): Promise<Paginated<Notification>> {
    await this.assertMembership(tenantId, requesterId);
    const baseWhere: Prisma.NotificationWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(readStatus ? { readStatus } : {}),
    };
    return this.list(query, { searchableFields: NOTIFICATION_SEARCHABLE_FIELDS }, baseWhere);
  }

  async findOne(notificationId: string, requesterId: string): Promise<Notification> {
    const notification = await this.getNotificationOrThrow(notificationId);
    await this.assertMembership(notification.tenantId, requesterId, true);
    return notification;
  }

  async markRead(notificationId: string, requesterId: string): Promise<Notification> {
    const notification = await this.getNotificationOrThrow(notificationId);
    await this.assertMembership(notification.tenantId, requesterId, true);
    return super.update({ id: notificationId }, { readStatus: "read" });
  }

  private async getNotificationOrThrow(notificationId: string): Promise<Notification> {
    const notification = await this.findUnique({ id: notificationId });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    return notification;
  }

  // notFoundOnFailure mirrors EventsService/RulesService's findOne: a 403
  // would confirm the notification exists to callers who aren't tenant
  // members, so single-notification reads 404 instead.
  private async assertMembership(
    tenantId: string,
    requesterId: string,
    notFoundOnFailure = false,
  ): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      if (notFoundOnFailure) {
        throw new NotFoundException("Notification not found");
      }
      throw new ForbiddenException("Not a member of this tenant");
    }
  }
}
