"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/api-client";

export type SocketStatus = "connecting" | "connected" | "disconnected";

export interface LiveNotification {
  notificationId: string;
  tenantId: string;
  userId: string;
  payload: { subject?: string; body?: string } & Record<string, unknown>;
  createdAt: string;
}

// Emitted by NotificationStatusPushConsumerService whenever an existing
// notification's status changes (pending -> sent/retrying/dead_letter) --
// distinct from "notification" (a brand-new dashboard-channel row), so a
// consumer can quietly refetch instead of treating it like a new arrival.
export interface NotificationStatusUpdate {
  notificationId: string;
  tenantId: string;
  status: string;
}

// Mirrors the connect -> wait for "authenticated" -> emit "subscribe" ->
// listen for "notification"/"notification_status" contract
// notifications.gateway.ts expects (see readme.md's dashboard-push entry)
// -- the demo requirement for a live-updating notifications page.
export function useNotificationSocket(
  tenantId: string | undefined,
  onNotification: (notification: LiveNotification) => void,
  onStatusUpdate?: (update: NotificationStatusUpdate) => void,
): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;
  const statusCallbackRef = useRef(onStatusUpdate);
  statusCallbackRef.current = onStatusUpdate;

  useEffect(() => {
    if (!tenantId) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    setStatus("connecting");
    const socket: Socket = io(API_URL, { auth: { token }, transports: ["websocket"] });

    socket.on("authenticated", () => {
      socket.emit("subscribe", { tenantId });
    });
    socket.on("subscribed", () => setStatus("connected"));
    socket.on("subscribe_error", () => setStatus("disconnected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));
    socket.on("notification", (notification: LiveNotification) => {
      callbackRef.current(notification);
    });
    socket.on("notification_status", (update: NotificationStatusUpdate) => {
      statusCallbackRef.current?.(update);
    });

    return () => {
      socket.disconnect();
    };
  }, [tenantId]);

  return status;
}
