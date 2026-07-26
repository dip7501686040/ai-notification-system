import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BaseCrudService,
  parseListQuery,
  type Paginated,
  type RawListQuery,
} from "@ai-notification/common";
import { getUserViaGrpc } from "@ai-notification/grpc";
import type { Prisma, Tenant, TenantMember } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";
import type { CreateTenantDto } from "./dto/create-tenant.dto";
import type { UpdateTenantDto } from "./dto/update-tenant.dto";
import type { AddMemberDto, TenantRole } from "./dto/add-member.dto";

const MANAGE_TENANT_ROLES: TenantRole[] = ["owner", "admin"];
const TENANT_SEARCHABLE_FIELDS = ["name", "slug"];
const MEMBER_SEARCHABLE_FIELDS = ["role", "userId"];

@Injectable()
export class TenantsService extends BaseCrudService<
  Tenant,
  Prisma.TenantCreateInput,
  Prisma.TenantUpdateInput,
  Prisma.TenantWhereUniqueInput,
  Prisma.TenantWhereInput,
  Prisma.TenantOrderByWithRelationInput
> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.tenant);
  }

  async create(ownerId: string, dto: CreateTenantDto): Promise<Tenant>;
  async create(data: Prisma.TenantCreateInput): Promise<Tenant>;
  async create(
    ownerIdOrData: string | Prisma.TenantCreateInput,
    dto?: CreateTenantDto,
  ): Promise<Tenant> {
    if (typeof ownerIdOrData !== "string") {
      return super.create(ownerIdOrData);
    }

    const existing = await this.findUnique({ slug: dto!.slug });
    if (existing) {
      throw new ConflictException("Slug is already taken");
    }

    return super.create({
      name: dto!.name,
      slug: dto!.slug,
      plan: dto!.plan ?? "free",
      members: { create: { userId: ownerIdOrData, role: "owner" } },
    });
  }

  // Tenants visible to a user are scoped to their memberships, so this
  // joins through TenantMember rather than using the base class's list()
  // (which queries the Tenant delegate directly with no user scoping).
  async findAllForUser(
    userId: string,
    query: RawListQuery,
  ): Promise<Paginated<Tenant & { role: string }>> {
    const parsed = parseListQuery(query, { searchableFields: TENANT_SEARCHABLE_FIELDS });
    const tenantWhere = parsed.where as Prisma.TenantWhereInput | undefined;
    const orderBy = parsed.orderBy as Array<Record<string, "asc" | "desc">> | undefined;

    const where: Prisma.TenantMemberWhereInput = {
      userId,
      ...(tenantWhere ? { tenant: tenantWhere } : {}),
    };

    const [memberships, total] = await Promise.all([
      this.prisma.tenantMember.findMany({
        where,
        include: { tenant: true },
        skip: parsed.skip,
        take: parsed.take,
        orderBy: orderBy?.map((clause) => ({ tenant: clause })),
      }),
      this.prisma.tenantMember.count({ where }),
    ]);

    return {
      list: memberships.map(({ tenant, role }) => ({ ...tenant, role })),
      total,
      page: parsed.page,
      pageSize: parsed.limit,
    };
  }

  async findOne(tenantId: string, userId: string): Promise<Tenant> {
    await this.requireMembership(tenantId, userId);
    return this.getTenantOrThrow(tenantId);
  }

  async updateTenant(tenantId: string, userId: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.requireRole(tenantId, userId, MANAGE_TENANT_ROLES);
    await this.getTenantOrThrow(tenantId);

    return super.update({ id: tenantId }, dto as Prisma.TenantUpdateInput);
  }

  async remove(tenantId: string, userId: string): Promise<void> {
    await this.requireRole(tenantId, userId, ["owner"]);
    await this.getTenantOrThrow(tenantId);
    await super.delete({ id: tenantId });
  }

  async listMembers(
    tenantId: string,
    userId: string,
    query: RawListQuery,
  ): Promise<Paginated<TenantMember>> {
    await this.requireMembership(tenantId, userId);

    const parsed = parseListQuery(query, { searchableFields: MEMBER_SEARCHABLE_FIELDS });
    const where: Prisma.TenantMemberWhereInput = {
      tenantId,
      ...(parsed.where as Prisma.TenantMemberWhereInput | undefined),
    };

    const [list, total] = await Promise.all([
      this.prisma.tenantMember.findMany({
        where,
        skip: parsed.skip,
        take: parsed.take,
        orderBy: parsed.orderBy as Prisma.TenantMemberOrderByWithRelationInput[] | undefined,
      }),
      this.prisma.tenantMember.count({ where }),
    ]);

    return { list, total, page: parsed.page, pageSize: parsed.limit };
  }

  async addMember(tenantId: string, userId: string, dto: AddMemberDto): Promise<TenantMember> {
    await this.requireRole(tenantId, userId, MANAGE_TENANT_ROLES);
    await this.getTenantOrThrow(tenantId);

    const existing = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: dto.userId } },
    });
    if (existing) {
      throw new ConflictException("User is already a member of this tenant");
    }

    return this.prisma.tenantMember.create({
      data: { tenantId, userId: dto.userId, role: dto.role ?? "member" },
    });
  }

  async updateMemberRole(
    tenantId: string,
    userId: string,
    targetUserId: string,
    role: TenantRole,
  ): Promise<TenantMember> {
    await this.requireRole(tenantId, userId, ["owner"]);
    await this.getMembershipOrThrow(tenantId, targetUserId);

    if (role !== "owner") {
      await this.assertNotLastOwner(tenantId, targetUserId);
    }

    return this.prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      data: { role },
    });
  }

  async removeMember(tenantId: string, userId: string, targetUserId: string): Promise<void> {
    await this.requireRole(tenantId, userId, MANAGE_TENANT_ROLES);
    await this.getMembershipOrThrow(tenantId, targetUserId);
    await this.assertNotLastOwner(tenantId, targetUserId);

    await this.prisma.tenantMember.delete({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
    });
  }

  async getMembership(tenantId: string, userId: string): Promise<TenantMember | null> {
    return this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }

  // Platform-wide, not scoped to the caller's own memberships at all --
  // a super admin isn't necessarily a member of any given tenant.
  // Authorization is defense-in-depth: api-gateway's SuperAdminGuard
  // fast-fails first, but this independently re-confirms via
  // identity-service rather than trusting the gateway alone (same
  // reasoning as every other cross-service check in this codebase).
  async findAllAsAdmin(requesterId: string, query: RawListQuery): Promise<Paginated<Tenant>> {
    await this.requireSuperAdmin(requesterId);
    return this.list(query, { searchableFields: TENANT_SEARCHABLE_FIELDS });
  }

  async setStatusAsAdmin(requesterId: string, tenantId: string, status: string): Promise<Tenant> {
    await this.requireSuperAdmin(requesterId);
    await this.getTenantOrThrow(tenantId);
    return super.update({ id: tenantId }, { status });
  }

  private async requireSuperAdmin(requesterId: string): Promise<void> {
    const result = await getUserViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, requesterId);
    if (!result.found || !result.user?.isSuperAdmin) {
      throw new ForbiddenException("Super admin access required");
    }
  }

  private async getTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.findUnique({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return tenant;
  }

  private async getMembershipOrThrow(tenantId: string, userId: string): Promise<TenantMember> {
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundException("Membership not found");
    }
    return membership;
  }

  private async requireMembership(tenantId: string, userId: string): Promise<TenantMember> {
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundException("Tenant not found");
    }
    return membership;
  }

  private async requireRole(
    tenantId: string,
    userId: string,
    allowedRoles: TenantRole[],
  ): Promise<TenantMember> {
    const membership = await this.requireMembership(tenantId, userId);
    if (!allowedRoles.includes(membership.role as TenantRole)) {
      throw new ForbiddenException("Insufficient tenant role");
    }
    return membership;
  }

  private async assertNotLastOwner(tenantId: string, userId: string): Promise<void> {
    const membership = await this.getMembership(tenantId, userId);
    if (membership?.role !== "owner") {
      return;
    }

    const ownerCount = await this.prisma.tenantMember.count({
      where: { tenantId, role: "owner" },
    });
    if (ownerCount <= 1) {
      throw new ForbiddenException("Cannot remove the last owner of a tenant");
    }
  }
}
