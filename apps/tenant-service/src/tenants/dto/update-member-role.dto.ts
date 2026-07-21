import { IsIn } from "class-validator";
import { TENANT_ROLES, type TenantRole } from "./add-member.dto";

export class UpdateMemberRoleDto {
  @IsIn(TENANT_ROLES)
  role!: TenantRole;
}
