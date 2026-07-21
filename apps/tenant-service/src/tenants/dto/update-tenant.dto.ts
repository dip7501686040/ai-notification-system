import { IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsIn(["active", "suspended", "archived"])
  status?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
