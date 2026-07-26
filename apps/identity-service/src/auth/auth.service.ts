import * as crypto from "node:crypto";
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createLogger } from "@ai-notification/logger";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import type { User } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";

const logger = createLogger("identity-service");
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const EXCHANGE = "platform";
const AUDIT_CREATED_ROUTING_KEY = "audit.created";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  provider: string;
  isSuperAdmin: boolean;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    isSuperAdmin: user.isSuperAdmin,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name, provider: "local" },
    });

    return { user: toSafeUser(user), accessToken: this.issueToken(user) };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // FR-9 audit logging (Audit Service): fire-and-forget, generic
    // `audit.created` event -- identity-service has no other RabbitMQ
    // producer/consumer, this is its first use of the bus.
    await this.rabbitmq.publish(EXCHANGE, AUDIT_CREATED_ROUTING_KEY, {
      action: "user.login",
      tenantId: null,
      actorId: user.id,
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
    });

    return { user: toSafeUser(user), accessToken: this.issueToken(user) };
  }

  async validateOAuthUser(params: {
    email: string;
    name?: string;
    provider: string;
    providerId: string;
  }): Promise<AuthResult> {
    let user = await this.prisma.user.findUnique({ where: { email: params.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: params.email,
          name: params.name,
          provider: params.provider,
          providerId: params.providerId,
        },
      });
    }

    return { user: toSafeUser(user), accessToken: this.issueToken(user) };
  }

  // Always resolves (never reveals whether the email is registered). No
  // SMTP provider is configured in this environment, so the reset token is
  // logged rather than emailed -- this log line *is* the "email" here,
  // mirroring how Google OAuth is only wired up when real credentials are
  // present.
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    logger.info({ email: user.email, resetToken: token }, "Password reset requested");
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  issueToken(user: User): string {
    const payload: AuthTokenPayload = { sub: user.id, email: user.email };
    return this.jwt.sign(payload);
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toSafeUser(user) : null;
  }
}
