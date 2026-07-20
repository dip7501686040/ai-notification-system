import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";

@Controller()
export class GrpcHealthController {
  @GrpcMethod("Health", "Check")
  check() {
    return { status: "SERVING" };
  }
}
