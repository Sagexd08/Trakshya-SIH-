"use client";
import { useState } from "react";

export default function AssistantPanel() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Hi! Ask me about conflicts, energy, or scenarios. For example: 'Show upcoming conflicts in Delhi–Howrah section in next 45 minutes.'" }
  ]);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) });
      const j = await res.json();
      const text = j?.answer || j?.mock ? (j?.answer || "") + (j?.mock ? "\n\n(Mock data)" : "") : "No answer.";
      setMessages((m) => [...m, { role: "assistant", text }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${e}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-3 p-3 border rounded-md bg-neutral-900/40 border-neutral-800">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className={`inline-block px-3 py-2 rounded-md ${m.role === "user" ? "bg-sky-600/20 border border-sky-700/40" : "bg-neutral-800 border border-neutral-700"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm opacity-70">Thinking…</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask Gemini…"
          className="flex-1 px-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 focus:outline-none"
        />
        <button onClick={send} disabled={loading} className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}

