import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateRuleDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsArray()
  actions!: unknown[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
