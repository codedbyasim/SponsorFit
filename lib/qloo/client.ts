import { cacheGet, cacheKey, cacheSet } from "../cache";
import { allowQlooCall } from "../rate-limit";

const DEFAULT_BASE = "https://hackathon.api.qloo.com";

export class QlooError extends Error {
  constructor(public code: "missing_key" | "auth" | "rate" | "budget" | "bad_request" | "upstream") {
    super(code);
    this.name = "QlooError";
  }
}

export function qlooConfigured(): boolean {
  return Boolean(process.env.QLOO_API_KEY?.trim());
}

function baseUrl(): string {
  const raw = process.env.QLOO_BASE_URL?.trim() || DEFAULT_BASE;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new QlooError("bad_request");
  }
  if (url.protocol !== "https:") throw new QlooError("bad_request");
  return url.origin;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function qlooGet(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.QLOO_API_KEY?.trim();
  if (!key) throw new QlooError("missing_key");

  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    if (value !== "") clean[name] = value;
  }
  if (clean.take) {
    const take = Number(clean.take);
    clean.take = String(Math.min(50, Math.max(1, Number.isFinite(take) ? take : 20)));
  }

  const stored = cacheKey(path, clean);
  const hit = cacheGet<unknown>(stored);
  if (hit) {
    console.info(JSON.stringify({ msg: "qloo", path, cache: "hit" }));
    return hit;
  }
  // Budget is checked only for real upstream calls; cache hits are free.
  if (!allowQlooCall()) throw new QlooError("budget");

  const url = new URL(path, baseUrl());
  for (const [name, value] of Object.entries(clean)) url.searchParams.set(name, value);

  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "X-Api-Key": key },
        cache: "no-store",
        // /search bodies are large (full tag trees per hit), so allow slow downloads.
        signal: AbortSignal.timeout(30_000),
      });
      lastStatus = response.status;
      console.info(JSON.stringify({ msg: "qloo", path, status: response.status, ms: Date.now() - started, attempt }));
      if (response.status === 404) return { results: [] };
      if (response.status === 401 || response.status === 403) throw new QlooError("auth");
      if (response.status === 400) throw new QlooError("bad_request");
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 0) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(1500, retryAfter * 1000) : 400;
          await sleep(wait);
          continue;
        }
        throw new QlooError(response.status === 429 ? "rate" : "upstream");
      }
      if (!response.ok) throw new QlooError("upstream");
      const data: unknown = await response.json();
      cacheSet(stored, data);
      return data;
    } catch (error) {
      if (error instanceof QlooError) throw error;
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      if (attempt === 0 && !timedOut) {
        await sleep(400);
        continue;
      }
      console.info(JSON.stringify({ msg: "qloo_transport", path, status: lastStatus }));
      throw new QlooError("upstream");
    }
  }
  throw new QlooError("upstream");
}

export function searchEntities(query: string): Promise<unknown> {
  return qlooGet("/search", { query, take: "5", sort_by: "match" });
}

export function getEntity(id: string): Promise<unknown> {
  return qlooGet("/entities", { entity_ids: id });
}

export function insights(params: Record<string, string>): Promise<unknown> {
  return qlooGet("/v2/insights", params);
}

export function compareEntities(a: string, b: string): Promise<unknown> {
  return qlooGet("/v2/analysis/compare", {
    "a.signal.interests.entities": a,
    "b.signal.interests.entities": b,
  });
}
