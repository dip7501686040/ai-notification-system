import { IsIn, IsOptional, IsString } from "class-validator";

export const TENANT_ROLES = ["owner", "admin", "member"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export class AddMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsIn(TENANT_ROLES)
  role?: TenantRole;
}
