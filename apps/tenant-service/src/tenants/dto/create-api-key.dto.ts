import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateApiKeyDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimit?: number;
}
