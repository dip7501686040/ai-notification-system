import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { User } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  provider: string;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
}

function toSafeUser(user: User): SafeUser {
  return { id: user.id, email: user.email, name: user.name, provider: user.provider };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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

  issueToken(user: User): string {
    const payload: AuthTokenPayload = { sub: user.id, email: user.email };
    return this.jwt.sign(payload);
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toSafeUser(user) : null;
  }
}
