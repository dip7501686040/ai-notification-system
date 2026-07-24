import { IsIn, IsString, MinLength } from "class-validator";

export class SetAiConfigDto {
  @IsString()
  tenantId!: string;

  @IsIn(["anthropic", "openai", "ollama"])
  provider!: string;

  @IsString()
  @MinLength(1)
  model!: string;
}
