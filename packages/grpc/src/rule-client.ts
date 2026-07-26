import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface RuleResult {
  id: string;
  tenantId: string;
  name: string;
  eventType: string;
  conditions: unknown;
  actions: unknown;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRulesResult {
  list: RuleResult[];
  total: number;
  page: number;
  pageSize: number;
}

// Same shape as RawListQuery (packages/common/src/list-query.ts) -- kept
// structurally compatible rather than imported (see tenant-client.ts).
export interface RuleListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

interface RuleWireMessage {
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

interface ListQueryWireMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListRulesWireResponse {
  list: RuleWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface SuccessWireResponse {
  success: boolean;
}

function createClient(address: string): grpc.Client {
  const proto = loadProto("rule.proto") as unknown as {
    rule: { v1: { Rule: grpc.ServiceClientConstructor } };
  };
  return new proto.rule.v1.Rule(address, grpc.credentials.createInsecure());
}

function toRuleResult(wire: RuleWireMessage): RuleResult {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    name: wire.name,
    eventType: wire.event_type,
    conditions: wire.conditions_json ? JSON.parse(wire.conditions_json) : {},
    actions: wire.actions_json ? JSON.parse(wire.actions_json) : [],
    enabled: wire.enabled,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

function toQueryWire(query: RuleListQueryParams): ListQueryWireMessage {
  return {
    page: query.page ?? "",
    limit: query.limit ?? "",
    search: query.search ?? "",
    sort_fields: query.sort_fields ?? "",
    sort_type: query.sort_type ?? "",
  };
}

function toEnabledState(enabled: boolean | undefined): string {
  return enabled === undefined ? "" : String(enabled);
}

export async function createRuleViaGrpc(
  address: string,
  requesterId: string,
  data: {
    tenantId: string;
    name: string;
    eventType: string;
    conditions?: unknown;
    actions: unknown;
    enabled?: boolean;
  },
): Promise<RuleResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      {
        requester_id: string;
        tenant_id: string;
        name: string;
        event_type: string;
        conditions_json: string;
        actions_json: string;
        enabled_state: string;
      },
      RuleWireMessage
    >(client, "CreateRule", {
      requester_id: requesterId,
      tenant_id: data.tenantId,
      name: data.name,
      event_type: data.eventType,
      conditions_json: data.conditions !== undefined ? JSON.stringify(data.conditions) : "",
      actions_json: JSON.stringify(data.actions),
      enabled_state: toEnabledState(data.enabled),
    });
    return toRuleResult(response);
  } finally {
    client.close();
  }
}

export async function listRulesViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  query: RuleListQueryParams,
): Promise<PaginatedRulesResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; query: ListQueryWireMessage },
      ListRulesWireResponse
    >(client, "ListRules", {
      requester_id: requesterId,
      tenant_id: tenantId,
      query: toQueryWire(query),
    });
    return {
      list: response.list.map(toRuleResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function getRuleViaGrpc(
  address: string,
  requesterId: string,
  ruleId: string,
): Promise<RuleResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<{ requester_id: string; rule_id: string }, RuleWireMessage>(
      client,
      "GetRule",
      { requester_id: requesterId, rule_id: ruleId },
    );
    return toRuleResult(response);
  } finally {
    client.close();
  }
}

export async function updateRuleViaGrpc(
  address: string,
  requesterId: string,
  ruleId: string,
  data: {
    name?: string;
    eventType?: string;
    conditions?: unknown;
    actions?: unknown;
    enabled?: boolean;
  },
): Promise<RuleResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      {
        requester_id: string;
        rule_id: string;
        name: string;
        event_type: string;
        conditions_json: string;
        actions_json: string;
        enabled_state: string;
      },
      RuleWireMessage
    >(client, "UpdateRule", {
      requester_id: requesterId,
      rule_id: ruleId,
      name: data.name ?? "",
      event_type: data.eventType ?? "",
      conditions_json: data.conditions !== undefined ? JSON.stringify(data.conditions) : "",
      actions_json: data.actions !== undefined ? JSON.stringify(data.actions) : "",
      enabled_state: toEnabledState(data.enabled),
    });
    return toRuleResult(response);
  } finally {
    client.close();
  }
}

export async function deleteRuleViaGrpc(
  address: string,
  requesterId: string,
  ruleId: string,
): Promise<void> {
  const client = createClient(address);
  try {
    await callUnary<{ requester_id: string; rule_id: string }, SuccessWireResponse>(
      client,
      "DeleteRule",
      { requester_id: requesterId, rule_id: ruleId },
    );
  } finally {
    client.close();
  }
}

export async function hasMatchingRuleViaGrpc(
  address: string,
  tenantId: string,
  eventType: string,
): Promise<boolean> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { tenant_id: string; event_type: string },
      { has_match: boolean }
    >(client, "HasMatchingRule", { tenant_id: tenantId, event_type: eventType });
    return response.has_match;
  } finally {
    client.close();
  }
}
