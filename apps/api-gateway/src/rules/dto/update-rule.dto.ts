import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  actions?: unknown[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
