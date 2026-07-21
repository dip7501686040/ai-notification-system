import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import type { Prisma, Rule } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";
import type { CreateRuleDto } from "./dto/create-rule.dto";
import type { UpdateRuleDto } from "./dto/update-rule.dto";

const RULE_SEARCHABLE_FIELDS = ["name", "eventType"];

@Injectable()
export class RulesService extends BaseCrudService<
  Rule,
  Prisma.RuleCreateInput,
  Prisma.RuleUpdateInput,
  Prisma.RuleWhereUniqueInput,
  Prisma.RuleWhereInput,
  Prisma.RuleOrderByWithRelationInput
> {
  constructor(private readonly prisma: PrismaService) {
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

    await this.assertMembership(dto!.tenantId, requesterIdOrData);

    return super.create({
      tenantId: dto!.tenantId,
      name: dto!.name,
      eventType: dto!.eventType,
      conditions: (dto!.conditions ?? {}) as Prisma.InputJsonValue,
      actions: dto!.actions as Prisma.InputJsonValue,
      enabled: dto!.enabled ?? true,
    });
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
    await this.assertMembership(rule.tenantId, requesterId, true);

    return super.update(
      { id: ruleId },
      {
        name: dto.name,
        eventType: dto.eventType,
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        actions: dto.actions as Prisma.InputJsonValue | undefined,
        enabled: dto.enabled,
      },
    );
  }

  async remove(ruleId: string, requesterId: string): Promise<void> {
    const rule = await this.getRuleOrThrow(ruleId);
    await this.assertMembership(rule.tenantId, requesterId, true);
    await super.delete({ id: ruleId });
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

  private async getRuleOrThrow(ruleId: string): Promise<Rule> {
    const rule = await this.findUnique({ id: ruleId });
    if (!rule) {
      throw new NotFoundException("Rule not found");
    }
    return rule;
  }

  // notFoundOnFailure mirrors EventsService.findOne: a 403 would confirm
  // the rule exists to callers who aren't tenant members, so single-rule
  // reads/writes 404 instead.
  private async assertMembership(
    tenantId: string,
    requesterId: string,
    notFoundOnFailure = false,
  ): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      if (notFoundOnFailure) {
        throw new NotFoundException("Rule not found");
      }
      throw new ForbiddenException("Not a member of this tenant");
    }
  }
}
