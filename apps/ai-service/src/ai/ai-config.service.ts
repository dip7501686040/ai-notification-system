import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";
import {
  defaultModelFor,
  isProviderConfigured,
  isSupportedProvider,
  SUPPORTED_PROVIDERS,
  type SupportedProvider,
} from "./providers/provider-registry";

const MANAGE_AI_CONFIG_ROLES = ["owner", "admin"];

export interface EffectiveAiConfig {
  provider: string;
  model: string;
}

@Injectable()
export class AiConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // No membership-gated read here -- called internally by AiAnalysisService
  // for every event, not on a caller's behalf.
  async getEffectiveConfig(tenantId: string): Promise<EffectiveAiConfig> {
    const stored = await this.prisma.tenantAiConfig.findUnique({ where: { tenantId } });
    if (stored) {
      return { provider: stored.provider, model: stored.model };
    }
    const provider = env.DEFAULT_AI_PROVIDER;
    return { provider, model: defaultModelFor(provider as SupportedProvider) };
  }

  async getConfig(tenantId: string, requesterId: string): Promise<EffectiveAiConfig> {
    await this.requireMemberRole(tenantId, requesterId, [...MANAGE_AI_CONFIG_ROLES, "member"]);
    return this.getEffectiveConfig(tenantId);
  }

  async setConfig(
    tenantId: string,
    requesterId: string,
    provider: string,
    model: string,
  ): Promise<EffectiveAiConfig> {
    await this.requireMemberRole(tenantId, requesterId, MANAGE_AI_CONFIG_ROLES);

    if (!isSupportedProvider(provider)) {
      throw new BadRequestException(
        `Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
      );
    }
    if (!isProviderConfigured(provider)) {
      throw new BadRequestException(`Provider "${provider}" is not configured on this platform`);
    }
    if (!model) {
      throw new BadRequestException("model is required");
    }

    await this.prisma.tenantAiConfig.upsert({
      where: { tenantId },
      create: { tenantId, provider, model },
      update: { provider, model },
    });

    return { provider, model };
  }

  private async requireMemberRole(
    tenantId: string,
    requesterId: string,
    allowedRoles: string[],
  ): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, requesterId);
    if (!result.isMember) {
      throw new NotFoundException("Tenant not found");
    }
    if (!allowedRoles.includes(result.role)) {
      throw new ForbiddenException("Insufficient tenant role");
    }
  }
}
