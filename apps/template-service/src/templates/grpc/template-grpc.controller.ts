import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import type { RawListQuery } from "@ai-notification/common";
import type { Template } from "../../../generated/prisma-client";
import { TemplatesService } from "../templates.service";

interface TemplateMessage {
  id: string;
  tenant_id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
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

interface CreateTemplateRequest {
  requester_id: string;
  tenant_id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
}

interface ListTemplatesRequest {
  requester_id: string;
  tenant_id: string;
  query: ListQueryMessage;
}

interface ListTemplatesResponse {
  list: TemplateMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface GetTemplateRequest {
  requester_id: string;
  template_id: string;
}

interface UpdateTemplateRequest {
  requester_id: string;
  template_id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
}

interface DeleteTemplateRequest {
  requester_id: string;
  template_id: string;
}

interface RenderTemplateRequest {
  tenant_id: string;
  name: string;
  channel: string;
  variables_json: string;
}

interface RenderTemplateResponse {
  found: boolean;
  subject: string;
  body: string;
}

function toTemplateMessage(template: Template): TemplateMessage {
  return {
    id: template.id,
    tenant_id: template.tenantId,
    name: template.name,
    channel: template.channel,
    subject: template.subject ?? "",
    body: template.body,
    created_at: template.createdAt.toISOString(),
    updated_at: template.updatedAt.toISOString(),
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
export class TemplateGrpcController {
  constructor(private readonly templatesService: TemplatesService) {}

  @GrpcMethod("Template", "CreateTemplate")
  async createTemplate(data: CreateTemplateRequest): Promise<TemplateMessage> {
    const template = await this.templatesService.create(data.requester_id, {
      tenantId: data.tenant_id,
      name: data.name,
      channel: data.channel,
      subject: data.subject || undefined,
      body: data.body,
    });
    return toTemplateMessage(template);
  }

  @GrpcMethod("Template", "ListTemplates")
  async listTemplates(data: ListTemplatesRequest): Promise<ListTemplatesResponse> {
    const result = await this.templatesService.findAllForTenant(
      data.tenant_id,
      data.requester_id,
      toRawListQuery(data.query),
    );
    return {
      list: result.list.map(toTemplateMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("Template", "GetTemplate")
  async getTemplate(data: GetTemplateRequest): Promise<TemplateMessage> {
    const template = await this.templatesService.findOne(data.template_id, data.requester_id);
    return toTemplateMessage(template);
  }

  @GrpcMethod("Template", "UpdateTemplate")
  async updateTemplate(data: UpdateTemplateRequest): Promise<TemplateMessage> {
    const template = await this.templatesService.updateTemplate(
      data.template_id,
      data.requester_id,
      {
        name: data.name || undefined,
        channel: data.channel || undefined,
        subject: data.subject || undefined,
        body: data.body || undefined,
      },
    );
    return toTemplateMessage(template);
  }

  @GrpcMethod("Template", "DeleteTemplate")
  async deleteTemplate(data: DeleteTemplateRequest): Promise<SuccessResponse> {
    await this.templatesService.remove(data.template_id, data.requester_id);
    return { success: true };
  }

  @GrpcMethod("Template", "RenderTemplate")
  async renderTemplate(data: RenderTemplateRequest): Promise<RenderTemplateResponse> {
    const variables = data.variables_json ? JSON.parse(data.variables_json) : {};
    return this.templatesService.renderTemplate(data.tenant_id, data.name, data.channel, variables);
  }
}
