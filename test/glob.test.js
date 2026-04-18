const test = require("node:test");
const assert = require("node:assert/strict");

const { matchesAnyGlob } = require("../dist/core/glob");

test("matchesAnyGlob returns false for empty pattern list", () => {
  assert.equal(matchesAnyGlob("/api/users", []), false);
});

test("matchesAnyGlob matches exact and wildcard patterns", () => {
  assert.equal(matchesAnyGlob("/health", ["/health"]), true);
  assert.equal(matchesAnyGlob("/api/users/1", ["/api/**"]), true);
  assert.equal(matchesAnyGlob("/docs", ["/api/**", "/health"]), false);
});
