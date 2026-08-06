import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import type { Prisma, Rule } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";
import type { CreateRuleDto } from "./dto/create-rule.dto";
import type { UpdateRuleDto } from "./dto/update-rule.dto";

const logger = createLogger("rule-engine-service");
const RULE_SEARCHABLE_FIELDS = ["name", "eventType"];
const EXCHANGE = "platform";
const AUDIT_CREATED_ROUTING_KEY = "audit.created";
// Rules control automated dispatch -- meaningfully administrative, so
// mutations are gated to owner/admin (mirrors tenant-service's own
// MANAGE_TENANT_ROLES convention). Reads stay open to any member.
const MANAGE_ROLES = ["owner", "admin"];

@Injectable()
export class RulesService extends BaseCrudService<
  Rule,
  Prisma.RuleCreateInput,
  Prisma.RuleUpdateInput,
  Prisma.RuleWhereUniqueInput,
  Prisma.RuleWhereInput,
  Prisma.RuleOrderByWithRelationInput
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {
    super(prisma.rule);
  }

  async create(requesterId: string, dto: CreateRuleDto): Promise<Rule>;
  async create(data: Prisma.RuleCreateInput): Promise<Rule>;
  async create(
    requesterIdOrData: string | Prisma.RuleCreateInput,
    dto?: CreateRuleDto,
  ): Promise<Rule> {
    if (typeof requesterIdOrData !== "string") {
      return super.create(requesterIdOrData);
    }

    await this.assertMembership(dto!.tenantId, requesterIdOrData, false, MANAGE_ROLES);

    const rule = await super.create({
      tenantId: dto!.tenantId,
      name: dto!.name,
      eventType: dto!.eventType,
      conditions: (dto!.conditions ?? {}) as Prisma.InputJsonValue,
      actions: dto!.actions as Prisma.InputJsonValue,
      enabled: dto!.enabled ?? true,
    });

    await this.publishAudit("rule.created", rule, requesterIdOrData);
    return rule;
  }

  async findAllForTenant(
    tenantId: string,
    requesterId: string,
    query: RawListQuery,
  ): Promise<Paginated<Rule>> {
    await this.assertMembership(tenantId, requesterId);
    return this.list(query, { searchableFields: RULE_SEARCHABLE_FIELDS }, { tenantId });
  }

  async findOne(ruleId: string, requesterId: string): Promise<Rule> {
    const rule = await this.getRuleOrThrow(ruleId);
    await this.assertMembership(rule.tenantId, requesterId, true);
    return rule;
  }

  async updateRule(ruleId: string, requesterId: string, dto: UpdateRuleDto): Promise<Rule> {
    const rule = await this.getRuleOrThrow(ruleId);
    await this.assertMembership(rule.tenantId, requesterId, true, MANAGE_ROLES);

    const updated = await super.update(
      { id: ruleId },
      {
        name: dto.name,
        eventType: dto.eventType,
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        actions: dto.actions as Prisma.InputJsonValue | undefined,
        enabled: dto.enabled,
      },
    );

    await this.publishAudit("rule.updated", updated, requesterId);
    return updated;
  }

  async remove(ruleId: string, requesterId: string): Promise<void> {
    const rule = await this.getRuleOrThrow(ruleId);
    await this.assertMembership(rule.tenantId, requesterId, true, MANAGE_ROLES);
    await super.delete({ id: ruleId });
    await this.publishAudit("rule.deleted", rule, requesterId);
  }

  // Used by RuleConsumerService, not exposed over gRPC -- no requester to
  // authorize against, this runs entirely off a trusted internal event.
  async findActiveForEvaluation(tenantId: string, eventType: string): Promise<Rule[]> {
    return this.prisma.rule.findMany({
      where: {
        tenantId,
        enabled: true,
        OR: [{ eventType }, { eventType: "*" }],
      },
    });
  }

  // Called synchronously by event-service on every POST /events, so it
  // deliberately only checks the same eventType-or-wildcard match
  // findActiveForEvaluation uses -- not each matched rule's `conditions`,
  // which depends on the event payload and would mean duplicating (or
  // calling back into) the in-memory evaluator on every ingest.
  async hasEnabledRuleForType(tenantId: string, eventType: string): Promise<boolean> {
    const count = await this.prisma.rule.count({
      where: {
        tenantId,
        enabled: true,
        OR: [{ eventType }, { eventType: "*" }],
      },
    });
    return count > 0;
  }

  // FR-9 audit logging (Audit Service): fire-and-forget, mirrors the
  // shape AuditConsumerService expects for the generic `audit.created`
  // event -- rule.created/updated/deleted write the same metadata shape.
  // Guarded: the rule mutation itself is already committed by the time
  // this runs, so a RabbitMQ blip should cost an audit entry, not fail
  // the caller's create/update/delete.
  private async publishAudit(
    action: "rule.created" | "rule.updated" | "rule.deleted",
    rule: Rule,
    actorId: string,
  ): Promise<void> {
    try {
      await this.rabbitmq.publish(EXCHANGE, AUDIT_CREATED_ROUTING_KEY, {
        action,
        tenantId: rule.tenantId,
        actorId,
        targetType: "rule",
        targetId: rule.id,
        metadata: { name: rule.name, eventType: rule.eventType },
      });
    } catch (err) {
      logger.error({ err, action, ruleId: rule.id }, "Failed to publish audit event");
    }
  }

  private async getRuleOrThrow(ruleId: string): Promise<Rule> {
    const rule = await this.findUnique({ id: ruleId });
    if (!rule) {
      throw new NotFoundException("Rule not found");
    }
    return rule;
  }

  // notFoundOnFailure mirrors EventsService.findOne: a 403 would confirm
  // the rule exists to callers who aren't tenant members, so single-rule
  // reads/writes 404 instead. allowedRoles is a separate check on top --
  // insufficient role is always a real 403 (the caller already knows the
  // tenant exists, so nothing is leaked by saying so).
  private async assertMembership(
    tenantId: string,
    requesterId: string,
    notFoundOnFailure = false,
    allowedRoles?: string[],
  ): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      if (notFoundOnFailure) {
        throw new NotFoundException("Rule not found");
      }
      throw new ForbiddenException("Not a member of this tenant");
    }
    if (allowedRoles && !allowedRoles.includes(result.role)) {
      throw new ForbiddenException("Insufficient tenant role");
    }
  }
}
