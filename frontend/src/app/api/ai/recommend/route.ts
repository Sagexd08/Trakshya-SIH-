import { NextRequest } from "next/server";

// Structured recommendations via Gemini. Attempts JSON output; falls back to mock.

const GEMINI_JSON_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  const { query, context } = await req.json().catch(() => ({ query: "", context: {} }));

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query is required" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  if (!key) {
    return new Response(JSON.stringify({
      mock: true,
      recommendations: [
        { action: "Reschedule T123 by +4 min at NDLS", impact: "reduces overlap with T456", confidence: 0.72 },
        { action: "Temporary 60 km/h cap on section HWH-2", impact: "smooths throughput variance", confidence: 0.63 },
        { action: "Enable eco-mode for T789", impact: "-8% energy, negligible ETA impact", confidence: 0.58 },
      ]
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  try {
    const system = "You are an operations optimizer for Indian Railways. Respond ONLY with JSON array named recommendations, each with fields: action (string), impact (string), confidence (0..1).";
    const prompt = [
      { text: `${system}\nQuery: ${query}\nContext: ${JSON.stringify(context || {})}` }
    ];

    const r = await fetch(`${GEMINI_JSON_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: prompt }],
        generationConfig: { response_mime_type: "application/json" }
      }),
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `Gemini error ${r.status}`);

    // Try to parse JSON
    let payload: any = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { payload = { recommendations: [] }; }
    }

    const recs = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
    return new Response(JSON.stringify({ recommendations: recs }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({
      mock: true,
      recommendations: [
        { action: "Hold low-priority freight by 3 min at CNB", impact: "frees headway for express", confidence: 0.55 }
      ]
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
}

