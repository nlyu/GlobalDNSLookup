import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeDomain } from "../src/js/domain.js";

describe("normalizeDomain", () => {
  it("extracts and normalizes a hostname from a URL", () => {
    assert.equal(normalizeDomain(" HTTPS://WWW.Example.COM/path "), "www.example.com");
  });

  it("supports internationalized domains through URL punycode conversion", () => {
    assert.equal(normalizeDomain("https://例子.测试/path"), "xn--fsqu00a.xn--0zwm56d");
  });

  for (const value of ["", "localhost", "127.0.0.1", "bad_domain.example"]) {
    it(`rejects invalid input ${value}`, () => {
      assert.throws(() => normalizeDomain(value));
    });
  }
});
