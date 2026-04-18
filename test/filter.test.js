const test = require("node:test");
const assert = require("node:assert/strict");

const { shouldTrackEndpoint } = require("../dist/core/filter");

test("tracks all paths when include and exclude are empty", () => {
  assert.equal(shouldTrackEndpoint("/users/1", [], []), true);
  assert.equal(shouldTrackEndpoint("/health", [], []), true);
});

test("excludes paths matching exclude patterns", () => {
  assert.equal(shouldTrackEndpoint("/health", [], ["/health"]), false);
  assert.equal(
    shouldTrackEndpoint("/internal/metrics", [], ["/internal/**"]),
    false,
  );
  assert.equal(shouldTrackEndpoint("/users/1", [], ["/internal/**"]), true);
});

test("only tracks paths matching include patterns when include is set", () => {
  assert.equal(shouldTrackEndpoint("/api/users/1", ["/api/**"], []), true);
  assert.equal(shouldTrackEndpoint("/health", ["/api/**"], []), false);
});

test("exclude takes precedence over include", () => {
  assert.equal(
    shouldTrackEndpoint("/api/internal", ["/api/**"], ["/api/internal"]),
    false,
  );
});
