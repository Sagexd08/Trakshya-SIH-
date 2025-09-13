export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

function resolveUrl(path: string): string {
  const isAbs = /^https?:\/\//i.test(path);
  if (isAbs) return path;
  if (!API_BASE) return path; // use relative URL to same origin (Next.js API routes)
  return `${API_BASE}${path}`;
}

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveUrl(path), { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postJSON<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveUrl(path), { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, ...init });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}
