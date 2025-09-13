// Lightweight browser WebSocket client
export type WSHandler = (data: unknown) => void;

export function connectWS(onMessage?: WSHandler): WebSocket | null {
  if (typeof window === 'undefined') return null;
  const url = new URL('/api/ws', window.location.href);
  url.protocol = url.protocol.replace('http', 'ws');
  const ws = new WebSocket(url);

  ws.onmessage = (ev) => {
    let payload: unknown = ev.data;
    if (typeof ev.data === "string") {
      try { payload = JSON.parse(ev.data); } catch { payload = ev.data; }
    }
    onMessage?.(payload);
  };

  // Keep-alive pings
  const timer = setInterval(() => {
    try { if (ws.readyState === 1) { ws.send(JSON.stringify({ type: 'ping', t: Date.now() })); } } catch {}
  }, 25_000);

  ws.onclose = () => { clearInterval(timer); };

  return ws;
}

