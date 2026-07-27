import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import {
  checkMembershipViaGrpc,
  dispatchViaGrpc,
  renderTemplateViaGrpc,
} from "@ai-notification/grpc";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import type { Notification, Prisma } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env, retryBackoffMs } from "../env";

const NOTIFICATION_SEARCHABLE_FIELDS = ["channel", "target", "status"];
const EXCHANGE = "platform";
const DASHBOARD_CHANNEL = "dashboard";

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
  // rendering (plus an `eventType` alias for `type`, per FR-6).
  async createFromMatch(
    tenantId: string,
    eventId: string,
    ruleId: string,
    actions: unknown,
    eventContext: Record<string, unknown>,
  ): Promise<void> {
    if (!Array.isArray(actions)) {
      this.logger.warn(
        { tenantId, ruleId, eventId },
        "Ignoring rule match: actions is not an array",
      );
      return;
    }

    const variables = { ...eventContext, eventType: eventContext.type };

    for (const action of actions) {
      if (!isValidAction(action)) {
        this.logger.warn(
          { tenantId, ruleId, eventId, action },
          "Skipping malformed action for rule match",
        );
        continue;
      }

      let payload: Record<string, unknown> = variables;
      if (action.template) {
        const rendered = await renderTemplateViaGrpc(
          env.TEMPLATE_GRPC_ADDRESS,
          tenantId,
          action.template,
          action.channel,
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
        channel: action.channel,
        target: action.target,
        payload: payload as Prisma.InputJsonValue,
        status: "pending",
      });

      await this.rabbitmq.publish(EXCHANGE, "notification.created", {
        notificationId: notification.id,
        tenantId,
        eventId,
        ruleId,
        channel: notification.channel,
        target: notification.target,
      });

      await this.attemptDispatch(notification);
    }
  }

  async attemptDispatch(notification: Notification): Promise<Notification> {
    // The dashboard channel is best-effort/real-time, not a guaranteed
    // external send -- there's no meaningful "retry a live push" the way
    // SMTP/webhook retries make sense. api-gateway relays this over
    // RabbitMQ to whichever browser is actually connected; if nobody's
    // listening, the row still exists here as `readStatus: "unread"`,
    // fetchable later over REST.
    if (notification.channel === DASHBOARD_CHANNEL) {
      await this.rabbitmq.publish(EXCHANGE, "notification.dashboard.push", {
        notificationId: notification.id,
        tenantId: notification.tenantId,
        userId: notification.target,
        payload: notification.payload,
        createdAt: notification.createdAt,
      });
      return super.update({ id: notification.id }, { status: "sent", sentAt: new Date() });
    }

    const result = await dispatchViaGrpc(
      env.CHANNEL_GRPC_ADDRESS,
      notification.channel,
      notification.target,
      notification.payload,
    );

    if (result.success) {
      const sent = await super.update(
        { id: notification.id },
        { status: "sent", sentAt: new Date() },
      );
      await this.rabbitmq.publish(EXCHANGE, "notification.sent", {
        notificationId: sent.id,
        tenantId: sent.tenantId,
        channel: sent.channel,
        target: sent.target,
      });
      return sent;
    }

    const attempts = notification.attempts + 1;
    if (attempts >= notification.maxAttempts) {
      const deadLettered = await super.update(
        { id: notification.id },
        { status: "dead_letter", attempts, lastError: result.error },
      );
      await this.rabbitmq.publish(EXCHANGE, "notification.dead", {
        notificationId: deadLettered.id,
        tenantId: deadLettered.tenantId,
        channel: deadLettered.channel,
        target: deadLettered.target,
        error: result.error,
      });
      return deadLettered;
    }

    const delay = retryBackoffMs[Math.min(attempts - 1, retryBackoffMs.length - 1)] ?? 60000;
    const retrying = await super.update(
      { id: notification.id },
      {
        status: "retrying",
        attempts,
        lastError: result.error,
        nextAttemptAt: new Date(Date.now() + delay),
      },
    );
    await this.rabbitmq.publish(EXCHANGE, "notification.retry", {
      notificationId: retrying.id,
      tenantId: retrying.tenantId,
      channel: retrying.channel,
      target: retrying.target,
      attempts,
      nextAttemptAt: retrying.nextAttemptAt,
    });
    return retrying;
  }

  // Used by RetrySchedulerService's poll loop, not exposed over gRPC.
  async findDueForRetry(): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { status: "retrying", nextAttemptAt: { lte: new Date() } },
    });
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
