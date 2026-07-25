import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

const CHANNELS = ["email", "webhook", "dashboard"];

export class CreateTemplateDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(CHANNELS)
  channel!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;
}
