import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";

export interface ValidateTokenResult {
  valid: boolean;
  userId: string;
  email: string;
  error: string;
}

// Wire shape from the auth.proto response (keepCase: true -> snake_case,
// matching the .proto field names exactly). Mapped to ValidateTokenResult's
// camelCase before it reaches callers.
interface ValidateTokenWireResponse {
  valid: boolean;
  user_id: string;
  email: string;
  error: string;
}

interface AuthClient extends grpc.Client {
  ValidateToken(
    request: { token: string },
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: ValidateTokenWireResponse) => void,
  ): grpc.ClientUnaryCall;
}

export function validateTokenViaGrpc(
  address: string,
  token: string,
  timeoutMs = 3000,
): Promise<ValidateTokenResult> {
  return new Promise((resolve) => {
    const proto = loadProto("auth.proto") as unknown as {
      auth: { v1: { Auth: grpc.ServiceClientConstructor } };
    };
    const AuthClientCtor = proto.auth.v1.Auth;
    const client = new AuthClientCtor(
      address,
      grpc.credentials.createInsecure(),
    ) as unknown as AuthClient;
    const deadline = new Date(Date.now() + timeoutMs);

    client.ValidateToken({ token }, { deadline }, (error, response) => {
      client.close();

      if (error) {
        resolve({ valid: false, userId: "", email: "", error: error.message });
        return;
      }

      resolve({
        valid: response.valid,
        userId: response.user_id,
        email: response.email,
        error: response.error,
      });
    });
  });
}
