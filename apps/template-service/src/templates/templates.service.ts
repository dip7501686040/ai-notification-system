import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import type { Prisma, Template } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";
import { renderString } from "./render";
import type { CreateTemplateDto } from "./dto/create-template.dto";
import type { UpdateTemplateDto } from "./dto/update-template.dto";

const TEMPLATE_SEARCHABLE_FIELDS = ["name", "channel"];
// Templates control real notification content -- administrative, gated
// to owner/admin (mirrors tenant-service's own MANAGE_TENANT_ROLES
// convention). Reads stay open to any member.
const MANAGE_ROLES = ["owner", "admin"];

export interface RenderResult {
  found: boolean;
  subject: string;
  body: string;
}

@Injectable()
export class TemplatesService extends BaseCrudService<
  Template,
  Prisma.TemplateCreateInput,
  Prisma.TemplateUpdateInput,
  Prisma.TemplateWhereUniqueInput,
  Prisma.TemplateWhereInput,
  Prisma.TemplateOrderByWithRelationInput
> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.template);
  }

  async create(requesterId: string, dto: CreateTemplateDto): Promise<Template>;
  async create(data: Prisma.TemplateCreateInput): Promise<Template>;
  async create(
    requesterIdOrData: string | Prisma.TemplateCreateInput,
    dto?: CreateTemplateDto,
  ): Promise<Template> {
    if (typeof requesterIdOrData !== "string") {
      return super.create(requesterIdOrData);
    }

    await this.assertMembership(dto!.tenantId, requesterIdOrData, false, MANAGE_ROLES);

    return super.create({
      tenantId: dto!.tenantId,
      name: dto!.name,
      channel: dto!.channel,
      subject: dto!.subject,
      body: dto!.body,
    });
  }

  async findAllForTenant(
    tenantId: string,
    requesterId: string,
    query: RawListQuery,
  ): Promise<Paginated<Template>> {
    await this.assertMembership(tenantId, requesterId);
    return this.list(query, { searchableFields: TEMPLATE_SEARCHABLE_FIELDS }, { tenantId });
  }

  async findOne(templateId: string, requesterId: string): Promise<Template> {
    const template = await this.getTemplateOrThrow(templateId);
    await this.assertMembership(template.tenantId, requesterId, true);
    return template;
  }

  async updateTemplate(
    templateId: string,
    requesterId: string,
    dto: UpdateTemplateDto,
  ): Promise<Template> {
    const template = await this.getTemplateOrThrow(templateId);
    await this.assertMembership(template.tenantId, requesterId, true, MANAGE_ROLES);

    return super.update(
      { id: templateId },
      {
        name: dto.name,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
      },
    );
  }

  async remove(templateId: string, requesterId: string): Promise<void> {
    const template = await this.getTemplateOrThrow(templateId);
    await this.assertMembership(template.tenantId, requesterId, true, MANAGE_ROLES);
    await super.delete({ id: templateId });
  }

  // Used by notification-service via gRPC -- internal, no requester to
  // authorize against (same trust boundary as RulesService.findActiveForEvaluation).
  async renderTemplate(
    tenantId: string,
    name: string,
    channel: string,
    variables: Record<string, unknown>,
  ): Promise<RenderResult> {
    const template = await this.prisma.template.findUnique({
      where: { tenantId_name_channel: { tenantId, name, channel } },
    });

    if (!template) {
      return { found: false, subject: "", body: "" };
    }

    return {
      found: true,
      subject: template.subject ? renderString(template.subject, variables) : "",
      body: renderString(template.body, variables),
    };
  }

  private async getTemplateOrThrow(templateId: string): Promise<Template> {
    const template = await this.findUnique({ id: templateId });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    return template;
  }

  // notFoundOnFailure mirrors RulesService/NotificationsService's findOne:
  // a 403 would confirm the template exists to non-members, so single-
  // template reads/writes 404 instead. allowedRoles is a separate check
  // on top -- insufficient role is always a real 403.
  private async assertMembership(
    tenantId: string,
    requesterId: string,
    notFoundOnFailure = false,
    allowedRoles?: string[],
  ): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      if (notFoundOnFailure) {
        throw new NotFoundException("Template not found");
      }
      throw new ForbiddenException("Not a member of this tenant");
    }
    if (allowedRoles && !allowedRoles.includes(result.role)) {
      throw new ForbiddenException("Insufficient tenant role");
    }
  }
}
