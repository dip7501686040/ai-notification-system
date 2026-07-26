import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import type { RawListQuery } from "@ai-notification/common";
import type { Rule } from "../../../generated/prisma-client";
import { RulesService } from "../rules.service";

interface RuleMessage {
  id: string;
  tenant_id: string;
  name: string;
  event_type: string;
  conditions_json: string;
  actions_json: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface ListQueryMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface SuccessResponse {
  success: boolean;
}

interface CreateRuleRequest {
  requester_id: string;
  tenant_id: string;
  name: string;
  event_type: string;
  conditions_json: string;
  actions_json: string;
  enabled_state: string;
}

interface ListRulesRequest {
  requester_id: string;
  tenant_id: string;
  query: ListQueryMessage;
}

interface ListRulesResponse {
  list: RuleMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface GetRuleRequest {
  requester_id: string;
  rule_id: string;
}

interface UpdateRuleRequest {
  requester_id: string;
  rule_id: string;
  name: string;
  event_type: string;
  conditions_json: string;
  actions_json: string;
  enabled_state: string;
}

interface DeleteRuleRequest {
  requester_id: string;
  rule_id: string;
}

interface HasMatchingRuleRequest {
  tenant_id: string;
  event_type: string;
}

interface HasMatchingRuleResponse {
  has_match: boolean;
}

function toRuleMessage(rule: Rule): RuleMessage {
  return {
    id: rule.id,
    tenant_id: rule.tenantId,
    name: rule.name,
    event_type: rule.eventType,
    conditions_json: JSON.stringify(rule.conditions),
    actions_json: JSON.stringify(rule.actions),
    enabled: rule.enabled,
    created_at: rule.createdAt.toISOString(),
    updated_at: rule.updatedAt.toISOString(),
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
export class RuleGrpcController {
  constructor(private readonly rulesService: RulesService) {}

  @GrpcMethod("Rule", "CreateRule")
  async createRule(data: CreateRuleRequest): Promise<RuleMessage> {
    const rule = await this.rulesService.create(data.requester_id, {
      tenantId: data.tenant_id,
      name: data.name,
      eventType: data.event_type,
      conditions: data.conditions_json ? JSON.parse(data.conditions_json) : undefined,
      actions: data.actions_json ? JSON.parse(data.actions_json) : [],
      enabled: data.enabled_state === "" ? undefined : data.enabled_state === "true",
    });
    return toRuleMessage(rule);
  }

  @GrpcMethod("Rule", "ListRules")
  async listRules(data: ListRulesRequest): Promise<ListRulesResponse> {
    const result = await this.rulesService.findAllForTenant(
      data.tenant_id,
      data.requester_id,
      toRawListQuery(data.query),
    );
    return {
      list: result.list.map(toRuleMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("Rule", "GetRule")
  async getRule(data: GetRuleRequest): Promise<RuleMessage> {
    const rule = await this.rulesService.findOne(data.rule_id, data.requester_id);
    return toRuleMessage(rule);
  }

  @GrpcMethod("Rule", "UpdateRule")
  async updateRule(data: UpdateRuleRequest): Promise<RuleMessage> {
    const rule = await this.rulesService.updateRule(data.rule_id, data.requester_id, {
      name: data.name || undefined,
      eventType: data.event_type || undefined,
      conditions: data.conditions_json ? JSON.parse(data.conditions_json) : undefined,
      actions: data.actions_json ? JSON.parse(data.actions_json) : undefined,
      enabled: data.enabled_state === "" ? undefined : data.enabled_state === "true",
    });
    return toRuleMessage(rule);
  }

  @GrpcMethod("Rule", "DeleteRule")
  async deleteRule(data: DeleteRuleRequest): Promise<SuccessResponse> {
    await this.rulesService.remove(data.rule_id, data.requester_id);
    return { success: true };
  }

  @GrpcMethod("Rule", "HasMatchingRule")
  async hasMatchingRule(data: HasMatchingRuleRequest): Promise<HasMatchingRuleResponse> {
    const hasMatch = await this.rulesService.hasEnabledRuleForType(data.tenant_id, data.event_type);
    return { has_match: hasMatch };
  }
}
