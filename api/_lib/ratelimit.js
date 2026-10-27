// Small in-memory limiter so the public demo survives until the end of judging.
// Per serverless instance only: a floor, not a guarantee. The real cap is the
// spending limit set in the Token Factory console.
const hits = new Map();

export function allow(ip, perHour = 30, now = Date.now()) {
  const windowStart = now - 3600_000;
  const recent = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (recent.length >= perHour) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}
