import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCacheKey, DnsCache } from "../src/js/cache.js";

describe("DnsCache", () => {
  it("includes the resolver in cache keys", () => {
    assert.equal(
      createCacheKey("google", "example.com", "A", "1.0.1.0/24"),
      "google|example.com|A|1.0.1.0/24"
    );
  });

  it("returns a stored unexpired entry", () => {
    const cache = new DnsCache();
    const result = {
      status: "success",
      records: [{ value: "192.0.2.1", ttl: 10 }],
      cnames: []
    };

    cache.set("key", result);
    assert.deepEqual(cache.get("key"), result);
  });
});
