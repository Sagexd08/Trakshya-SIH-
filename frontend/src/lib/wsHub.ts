/* Simple in-memory WebSocket hub for broadcasting messages across route handlers.
   Note: Lives per-server instance; on serverless it is per-isolate and ephemeral. */

type WSMessageEvent = { data?: unknown };
export type WSLike = {
  readyState: number;
  send: (data: string) => void;
  addEventListener?: (type: "close" | "message", listener: (ev: WSMessageEvent) => void) => void;
};

const clients = new Set<WSLike>();

export function addClient(ws: WSLike) {
  try {
    clients.add(ws);
    ws.addEventListener?.("close", () => {
      try { clients.delete(ws); } catch {}
    });
  } catch {}
}

export function removeClient(ws: WSLike) {
  try { clients.delete(ws); } catch {}
}

export function broadcast(data: unknown) {
  const msg = typeof data === "string" ? data : JSON.stringify(data);
  for (const ws of Array.from(clients)) {
    try {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(msg);
      } else {
        clients.delete(ws);
      }
    } catch {
      clients.delete(ws);
    }
  }
}

export function size() {
  return clients.size;
}

