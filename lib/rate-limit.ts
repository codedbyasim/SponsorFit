type Bucket = { tokens: number; updated: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const IP_LIMIT = 8;
// One live scout with compare makes ~20 Qloo calls; the hackathon key allows 10/s and 50k/month.
const GLOBAL_LIMIT = 120;

function take(mapKey: string, limit: number, now: number): boolean {
  const bucket = buckets.get(mapKey) ?? { tokens: limit, updated: now };
  const elapsed = Math.max(0, now - bucket.updated);
  bucket.tokens = Math.min(limit, bucket.tokens + (elapsed / WINDOW_MS) * limit);
  bucket.updated = now;
  if (bucket.tokens < 1) {
    buckets.set(mapKey, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(mapKey, bucket);
  return true;
}

export function allowRequest(ip: string, now = Date.now()): boolean {
  return take(`ip:${ip || "unknown"}`, IP_LIMIT, now);
}

export function allowQlooCall(now = Date.now()): boolean {
  return take("qloo-global", GLOBAL_LIMIT, now);
}

export function resetLimits(): void {
  buckets.clear();
}
