import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { checkMembershipViaGrpc, validateTokenViaGrpc } from "@ai-notification/grpc";
import { env } from "../env";
import { SubscribeDto } from "./dto/subscribe.dto";

// No UI exists yet, so there's no known browser origin to lock CORS down
// to -- revisit once one does. @WebSocketGateway() already makes this
// class injectable -- no separate @Injectable() needed.
@WebSocketGateway({ cors: { origin: "*" } })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Auth happens once, at handshake -- the same validateTokenViaGrpc call
  // GrpcAuthGuard already makes for REST. A socket that fails auth is
  // disconnected outright.
  //
  // This is async (a real gRPC round-trip), so a client that emits
  // "subscribe" the instant "connect" fires can race ahead of it --
  // client.data.userId wouldn't be set yet. The "authenticated" event
  // below is the fix: clients must wait for it before subscribing, rather
  // than assuming "connected" already means "usable".
  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }

    const result = await validateTokenViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, token);
    if (!result.valid) {
      client.disconnect(true);
      return;
    }

    client.data.userId = result.userId;
    client.emit("authenticated");
  }

  // Membership is re-verified server-side via checkMembershipViaGrpc on
  // every subscribe -- the client's claimed tenantId is never trusted on
  // its own, same as every REST route in this codebase.
  //
  // @MessageBody() goes through the same global ValidationPipe as REST
  // DTOs -- it needs an actual class-validator-decorated class (not a
  // plain TS interface/type), or `whitelist: true` silently strips every
  // property.
  @SubscribeMessage("subscribe")
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeDto,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const tenantId = data?.tenantId;

    if (!userId) {
      // Not yet authenticated (or auth failed) -- tell the client rather
      // than disconnecting outright, since a well-behaved client waiting
      // for "authenticated" shouldn't hit this at all.
      client.emit("subscribe_error", { message: "Not authenticated yet" });
      return;
    }
    if (!tenantId) {
      client.emit("subscribe_error", { message: "tenantId is required" });
      return;
    }

    const membership = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, userId);
    if (!membership.isMember) {
      client.emit("subscribe_error", { message: "Not a member of this tenant" });
      return;
    }

    await client.join(`tenant:${tenantId}`);
    client.emit("subscribed", { tenantId });
    this.logger.log(`Socket ${client.id} (user ${userId}) subscribed to tenant ${tenantId}`);
  }
}
