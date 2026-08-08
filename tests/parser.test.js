import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDnsJson } from "../src/js/dns/parser.js";

describe("parseDnsJson", () => {
  it("extracts CNAME and A records with TTLs", () => {
    const result = parseDnsJson(
      {
        Status: 0,
        Answer: [
          { type: 5, data: "edge.example.net.", TTL: 60 },
          { type: 1, data: "192.0.2.1", TTL: 30 }
        ]
      },
      "A"
    );

    assert.deepEqual(result, {
      status: "success",
      cnames: [{ value: "edge.example.net", ttl: 60 }],
      records: [{ value: "192.0.2.1", ttl: 30 }]
    });
  });

  it("treats NXDOMAIN as a valid result", () => {
    assert.equal(parseDnsJson({ Status: 3 }, "AAAA").status, "nxdomain");
  });

  it("treats a missing record type as no data", () => {
    assert.equal(parseDnsJson({ Status: 0, Answer: [] }, "AAAA").status, "no_data");
  });
});
