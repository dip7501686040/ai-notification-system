import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthGrpcController } from "./grpc/auth-grpc.controller";
import { AuthService } from "./auth.service";
import { env } from "../env";

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN },
    }),
  ],
  controllers: [AuthGrpcController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
