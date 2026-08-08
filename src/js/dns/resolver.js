import { DnsCache, createCacheKey } from "../cache.js";
import { ConcurrencyQueue } from "../queue.js";
import { queryAliDns } from "./alidns.js";
import { errorLabel, ProviderError } from "./errors.js";
import { queryGoogle } from "./google.js";
import { ProviderHealth } from "./health.js";

const providers = {
  google: { id: "google", label: "Google", query: queryGoogle },
  alidns: { id: "alidns", label: "AliDNS", query: queryAliDns }
};

const queue = new ConcurrencyQueue(8);
const cache = new DnsCache();
const health = new ProviderHealth();

export async function resolveLocation(hostname, location) {
  const startedAt = performance.now();
  const [a, aaaa] = await Promise.all([
    resolveRecord(hostname, "A", location.subnet, location.preferredResolver),
    resolveRecord(hostname, "AAAA", location.subnet, location.preferredResolver)
  ]);

  return {
    location,
    cname: mergeCnames(a, aaaa),
    a,
    aaaa,
    status: locationStatus(a, aaaa),
    durationMs: Math.round(performance.now() - startedAt)
  };
}

export async function resolveRecord(hostname, type, subnet, preferredResolver = "google") {
  let lastError;

  for (const provider of providerOrder(preferredResolver)) {
    if (!health.canTry(provider.id)) {
      lastError = new ProviderError("provider_unavailable", `${provider.label} is cooling down.`);
      continue;
    }

    const key = createCacheKey(provider.id, hostname, type, subnet);
    const cached = cache.get(key);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      const value = await queue.run(() => provider.query(hostname, type, subnet));
      health.success(provider.id);
      cache.set(key, value);
      return value;
    } catch (error) {
      lastError = error;
      health.failure(provider.id);
    }
  }

  return {
    status: "failed",
    records: [],
    cnames: [],
    resolver: null,
    error: errorLabel(lastError)
  };
}

function providerOrder(preferredResolver) {
  const primary = providers[preferredResolver] ?? providers.google;
  const fallback = primary.id === "google" ? providers.alidns : providers.google;
  return [primary, fallback];
}

function mergeCnames(a, aaaa) {
  const seen = new Set();
  const merged = [];

  for (const result of [a, aaaa]) {
    for (const cname of result.cnames ?? []) {
      const key = cname.value;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
          ...cname,
          resolver: result.resolver,
          source: result === a ? "A" : "AAAA"
        });
      }
    }
  }

  return merged;
}

function locationStatus(a, aaaa) {
  if (a.status === "nxdomain" || aaaa.status === "nxdomain") {
    return "nxdomain";
  }
  if (a.status === "failed" && aaaa.status === "failed") {
    return "failed";
  }
  if (a.status === "failed" || aaaa.status === "failed") {
    return "partial_success";
  }
  return "success";
}
