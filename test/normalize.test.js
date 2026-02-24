const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeEndpointKey } = require("../dist/core/normalize");

test("normalizes method, dynamic path segments, and query keys", () => {
  const endpoint = normalizeEndpointKey({
    input: "https://api.example.com/users/123?include=posts&page=2&page=3",
    method: "get",
    dynamicSegmentPatterns: ["numeric", "uuid", "hash"],
  });

  assert.equal(endpoint, "GET /users/:param?include&page");
});

test("normalizes uuid path segments", () => {
  const endpoint = normalizeEndpointKey({
    input: "https://api.example.com/orders/4d4db7ef-05dd-4b6f-b4c3-fec9e0f8e2fe",
    method: "POST",
    dynamicSegmentPatterns: ["numeric", "uuid", "hash"],
  });

  assert.equal(endpoint, "POST /orders/:param");
});

test("falls back to unknown path on invalid URL", () => {
  const endpoint = normalizeEndpointKey({
    input: "://broken-url",
    method: "GET",
    dynamicSegmentPatterns: ["numeric", "uuid", "hash"],
  });

  assert.equal(endpoint, "GET /unknown");
});

