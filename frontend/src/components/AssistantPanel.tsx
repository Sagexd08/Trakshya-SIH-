"use client";
import { useState } from "react";

type Recommendation = { action: string; impact: string; confidence: number };

export default function AssistantPanel() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Hi! Ask me about conflicts, energy, or scenarios. For example: 'Show upcoming conflicts in Delhi–Howrah section in next 45 minutes.'" }
  ]);
  const [recs, setRecs] = useState<Recommendation[]>([]);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      // 1) Free-form answer
      const res = await fetch("/api/ai/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) });
      const j = await res.json();
      const text = j?.answer || j?.mock ? (j?.answer || "") + (j?.mock ? "\n\n(Mock data)" : "") : "No answer.";
      setMessages((m) => [...m, { role: "assistant", text }]);

      // 2) Structured recommendations
      const recRes = await fetch("/api/ai/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q, context: {} }) });
      const rj = await recRes.json();
      const list: Recommendation[] = Array.isArray(rj?.recommendations) ? rj.recommendations : [];
      setRecs(list);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${e}` }]);
      setRecs([]);
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
        {recs.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-sm opacity-80">Recommended actions</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recs.map((r, i) => (
                <div key={i} className="p-3 rounded-md border border-emerald-800/40 bg-emerald-900/10">
                  <div className="font-medium text-emerald-300">{r.action}</div>
                  <div className="text-sm text-neutral-300 mt-1">{r.impact}</div>
                  <div className="text-xs text-neutral-400 mt-2">Confidence: {(r.confidence * 100).toFixed(0)}%</div>
                  <div className="mt-3">
                    <button className="px-3 py-1.5 rounded bg-emerald-600/80 hover:bg-emerald-500 text-sm disabled:opacity-50" disabled>
                      Apply (coming soon)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {loading && <div className="text-sm opacity-70">Thinking…</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask Gemini… (e.g., 'Top 3 actions to reduce congestion in NDLS this hour')"
          className="flex-1 px-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 focus:outline-none"
        />
        <button onClick={send} disabled={loading} className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}
