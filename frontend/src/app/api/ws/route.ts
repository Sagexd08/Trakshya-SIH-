import { NextRequest } from "next/server";
import { addClient, broadcast, size } from "@/lib/wsHub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ensure not statically optimized

export function GET(req: NextRequest) {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  // @ts-expect-error Next.js Node runtime exposes WebSocketPair for upgrades
  const { 0: client, 1: server } = new WebSocketPair();

  const ws = server as WebSocket;

  // @ts-expect-error Next runtime WebSocket supports accept() during upgrade
  ws.accept();
  addClient(ws);

  // Greet and share basic info
  try {
    ws.send(JSON.stringify({ type: "hello", connected: true, clients: size(), t: Date.now() }));
  } catch {}

  // Heartbeat
  const interval = setInterval(() => {
    try { ws.send(JSON.stringify({ type: "heartbeat", t: Date.now() })); } catch {}
  }, 20_000);

  ws.addEventListener("message", (event: MessageEvent) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      // Echo back minimal ack
      ws.send(JSON.stringify({ type: "ack", t: Date.now(), echo: data?.type ?? "message" }));
    } catch {
      try { ws.send(JSON.stringify({ type: "ack", t: Date.now() })); } catch {}
    }
  });

  ws.addEventListener("close", () => {
    clearInterval(interval);
    try {
      broadcast({ type: "notice", text: "A client disconnected", t: Date.now() });
    } catch {}
  });

  // @ts-expect-error Next.js ResponseInit supports { webSocket } for 101 Switching Protocols

  return new Response(null, { status: 101, webSocket: client });
}

