import { IsIn } from "class-validator";

const PAID_PLANS = ["pro", "enterprise"];

export class CreateCheckoutSessionDto {
  @IsIn(PAID_PLANS)
  plan!: string;
}
