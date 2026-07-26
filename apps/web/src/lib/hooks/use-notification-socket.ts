"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/api-client";

export type SocketStatus = "connecting" | "connected" | "disconnected";

interface LiveNotification {
  notificationId: string;
  tenantId: string;
  userId: string;
  payload: { subject?: string; body?: string } & Record<string, unknown>;
  createdAt: string;
}

// Mirrors the connect -> wait for "authenticated" -> emit "subscribe" ->
// listen for "notification" contract notifications.gateway.ts expects
// (see readme.md's dashboard-push entry) -- the demo requirement for a
// live-updating notifications page.
export function useNotificationSocket(
  tenantId: string | undefined,
  onNotification: (notification: LiveNotification) => void,
): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

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

    return () => {
      socket.disconnect();
    };
  }, [tenantId]);

  return status;
}
