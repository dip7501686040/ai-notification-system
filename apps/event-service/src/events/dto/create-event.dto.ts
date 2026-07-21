import { IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateEventDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
