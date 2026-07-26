import { IsIn } from "class-validator";

const TENANT_STATUSES = ["active", "suspended"];

export class SetTenantStatusDto {
  @IsIn(TENANT_STATUSES)
  status!: string;
}
