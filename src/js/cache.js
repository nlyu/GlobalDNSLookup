const MIN_TTL_SECONDS = 5;
const MAX_TTL_SECONDS = 300;
const NEGATIVE_TTL_SECONDS = 30;

export class DnsCache {
  constructor() {
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    const ttl = cacheTtl(value);
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000
    });
  }
}

export function createCacheKey(resolver, hostname, type, subnet) {
  return `${resolver}|${hostname}|${type}|${subnet}`;
}

function cacheTtl(result) {
  const ttls = [...result.records, ...result.cnames]
    .map((record) => record.ttl)
    .filter((ttl) => Number.isFinite(ttl) && ttl > 0);

  if (ttls.length === 0) {
    return NEGATIVE_TTL_SECONDS;
  }

  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.min(...ttls)));
}
