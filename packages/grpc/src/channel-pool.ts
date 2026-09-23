import type * as grpc from "@grpc/grpc-js";

// grpc-js Client objects are designed to be long-lived and multiplex many
// RPCs over one persistent HTTP/2 connection -- opening a fresh one per call
// (the previous pattern in every *-client.ts factory) paid a full
// TCP+DNS+HTTP/2 handshake on every single RPC. Cached here per (service,
// address) pair so all *-client.ts factories can share one channel per
// downstream service instead.
const pool = new Map<string, grpc.Client>();

export function getPooledClient<T extends grpc.Client>(cacheKey: string, factory: () => T): T {
  const existing = pool.get(cacheKey);
  if (existing) {
    return existing as T;
  }
  const client = factory();
  pool.set(cacheKey, client);
  return client;
}

// For graceful shutdown (e.g. a Nest onModuleDestroy hook) -- not required
// for correctness, grpc-js channels don't keep the process alive on their
// own, but closing them explicitly avoids in-flight calls being reset mid-RPC.
export function closeAllPooledClients(): void {
  for (const client of pool.values()) {
    client.close();
  }
  pool.clear();
}
