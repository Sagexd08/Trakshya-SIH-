import { NextRequest } from "next/server";

// Minimal Gemini 1.5 call. Requires GEMINI_API_KEY env var.
// Fallback: returns mock insights when key is missing or API fails

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  const { query, context } = await req.json().catch(() => ({ query: "", context: {} }));

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query is required" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  if (!key) {
    return new Response(
      JSON.stringify({
        mock: true,
        answer: "Mock response: No Gemini key configured. Predicted conflicts minimal on Delhi–Howrah in next 45 minutes. Suggested: stagger departures by 3–5 min and reduce dwell at NDLS by 1 min.",
        recommendations: [
          { action: "Reschedule T123 by +4 min at NDLS", impact: "reduces overlap with T456", confidence: 0.72 },
          { action: "Temporary 60 km/h cap on section HWH-2", impact: "smooths throughput variance", confidence: 0.63 },
          { action: "Energy eco-mode for T789", impact: "-8% energy for negligible ETA impact", confidence: 0.58 }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const prompt = [
      { text: `You are an operations optimizer for Indian Railways. Answer succinctly with structured recommendations where applicable.\nUser Query: ${query}\nContext: ${JSON.stringify(context || {})}` }
    ];

    const r = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: prompt }] })
    });

    const j = await r.json();

    if (!r.ok) throw new Error(j?.error?.message || `Gemini error ${r.status}`);

    const text: string = j?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    return new Response(JSON.stringify({ answer: text }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        mock: true,
        answer: `Fallback due to error: ${message}`,
        recommendations: [
          { action: "Hold low-priority freight trains by 2–3 min", impact: "frees headway for expresses", confidence: 0.55 }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
}

