import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  provider: string;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
}

interface AuthResultWireMessage {
  user: AuthUser;
  access_token: string;
}

function createAuthClient(address: string): grpc.Client {
  const proto = loadProto("auth.proto") as unknown as {
    auth: { v1: { Auth: grpc.ServiceClientConstructor } };
  };
  return new proto.auth.v1.Auth(address, grpc.credentials.createInsecure());
}

function toAuthResult(wire: AuthResultWireMessage): AuthResult {
  return { user: wire.user, accessToken: wire.access_token };
}

export async function registerViaGrpc(
  address: string,
  email: string,
  password: string,
  name?: string,
): Promise<AuthResult> {
  const client = createAuthClient(address);
  try {
    const response = await callUnary<
      { email: string; password: string; name: string },
      AuthResultWireMessage
    >(client, "Register", { email, password, name: name ?? "" });
    return toAuthResult(response);
  } finally {
    client.close();
  }
}

export async function loginViaGrpc(
  address: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const client = createAuthClient(address);
  try {
    const response = await callUnary<{ email: string; password: string }, AuthResultWireMessage>(
      client,
      "Login",
      { email, password },
    );
    return toAuthResult(response);
  } finally {
    client.close();
  }
}

export async function getUserViaGrpc(
  address: string,
  userId: string,
): Promise<{ found: boolean; user: AuthUser | null }> {
  const client = createAuthClient(address);
  try {
    return await callUnary<{ user_id: string }, { found: boolean; user: AuthUser | null }>(
      client,
      "GetUser",
      { user_id: userId },
    );
  } finally {
    client.close();
  }
}

export async function validateOAuthUserViaGrpc(
  address: string,
  params: { email: string; name?: string; provider: string; providerId: string },
): Promise<AuthResult> {
  const client = createAuthClient(address);
  try {
    const response = await callUnary<
      { email: string; name: string; provider: string; provider_id: string },
      AuthResultWireMessage
    >(client, "ValidateOAuthUser", {
      email: params.email,
      name: params.name ?? "",
      provider: params.provider,
      provider_id: params.providerId,
    });
    return toAuthResult(response);
  } finally {
    client.close();
  }
}

export async function forgotPasswordViaGrpc(address: string, email: string): Promise<void> {
  const client = createAuthClient(address);
  try {
    await callUnary<{ email: string }, { success: boolean }>(client, "ForgotPassword", { email });
  } finally {
    client.close();
  }
}

export async function resetPasswordViaGrpc(
  address: string,
  token: string,
  newPassword: string,
): Promise<void> {
  const client = createAuthClient(address);
  try {
    await callUnary<{ token: string; new_password: string }, { success: boolean }>(
      client,
      "ResetPassword",
      { token, new_password: newPassword },
    );
  } finally {
    client.close();
  }
}
