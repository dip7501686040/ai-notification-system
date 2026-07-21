import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: "slug must be lowercase alphanumeric, dash-separated",
  })
  slug!: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
