const test = require("node:test");
const assert = require("node:assert/strict");

const { createTypedFetchCache, TypedFetchCache } = require("../dist/cache");

// ─── createTypedFetchCache / constructor ──────────────────────────────────────

test("createTypedFetchCache returns a TypedFetchCache instance", () => {
  const cache = createTypedFetchCache();
  assert.ok(cache instanceof TypedFetchCache);
});

test("default options are applied when none are provided", () => {
  const cache = createTypedFetchCache();
  assert.equal(cache.staleTime, 0);
  assert.equal(cache.gcTime, 5 * 60_000);
  assert.equal(cache.retry, 3);
  assert.equal(typeof cache.retryDelay, "function");
});

test("custom options override defaults", () => {
  const delay = (n) => n * 500;
  const cache = createTypedFetchCache({
    staleTime: 10_000,
    gcTime: 60_000,
    retry: 1,
    retryDelay: delay,
  });
  assert.equal(cache.staleTime, 10_000);
  assert.equal(cache.gcTime, 60_000);
  assert.equal(cache.retry, 1);
  assert.equal(cache.retryDelay, delay);
});

test("retry: false disables retries", () => {
  const cache = createTypedFetchCache({ retry: false });
  assert.equal(cache.retry, false);
});

test("default retryDelay applies exponential back-off capped at 30 s", () => {
  const cache = createTypedFetchCache();
  assert.equal(cache.retryDelay(0), 1_000);
  assert.equal(cache.retryDelay(1), 2_000);
  assert.equal(cache.retryDelay(2), 4_000);
  assert.equal(cache.retryDelay(10), 30_000); // cap
});

// ─── buildKey ────────────────────────────────────────────────────────────────

test("buildKey with string URL", () => {
  const cache = createTypedFetchCache();
  assert.equal(
    cache.buildKey("https://example.com/users", "GET"),
    "GET:https://example.com/users",
  );
});

test("buildKey with URL object", () => {
  const cache = createTypedFetchCache();
  const url = new URL("https://example.com/users");
  assert.equal(cache.buildKey(url, "POST"), "POST:https://example.com/users");
});

test("buildKey with Request object", () => {
  const cache = createTypedFetchCache();
  const req = new Request("https://example.com/items");
  assert.equal(
    cache.buildKey(req, "DELETE"),
    "DELETE:https://example.com/items",
  );
});

test("buildKey normalises method to uppercase", () => {
  const cache = createTypedFetchCache();
  assert.equal(
    cache.buildKey("https://example.com/x", "get"),
    "GET:https://example.com/x",
  );
});

// ─── get / set ───────────────────────────────────────────────────────────────

test("get returns undefined for a missing key", () => {
  const cache = createTypedFetchCache();
  assert.equal(cache.get("missing-key"), undefined);
});

test("set and get round-trips a result", () => {
  const cache = createTypedFetchCache();
  const result = { status: 200, data: { id: 1 } };
  cache.set("k1", result, "GET /users/:id");
  const entry = cache.get("k1");
  assert.ok(entry);
  assert.deepEqual(entry.result, result);
  assert.equal(entry.endpointKey, "GET /users/:id");
  assert.ok(typeof entry.fetchedAt === "number");
  cache.destroy();
});

test("set overwrites an existing entry and resets fetchedAt", async () => {
  const cache = createTypedFetchCache();
  cache.set("k1", { status: 200, data: "first" }, "GET /x");
  const firstFetchedAt = cache.get("k1").fetchedAt;

  await new Promise((r) => setTimeout(r, 5));

  cache.set("k1", { status: 200, data: "second" }, "GET /x");
  const secondFetchedAt = cache.get("k1").fetchedAt;

  assert.ok(secondFetchedAt >= firstFetchedAt);
  assert.deepEqual(cache.get("k1").result, { status: 200, data: "second" });
  cache.destroy();
});

// ─── isStale ─────────────────────────────────────────────────────────────────

test("isStale returns true when staleTime is 0 (default)", () => {
  const cache = createTypedFetchCache({ staleTime: 0 });
  cache.set("k1", {}, "GET /x");
  assert.equal(cache.isStale(cache.get("k1")), true);
  cache.destroy();
});

test("isStale returns false for a fresh entry within staleTime", () => {
  const cache = createTypedFetchCache({ staleTime: 60_000 });
  cache.set("k1", {}, "GET /x");
  assert.equal(cache.isStale(cache.get("k1")), false);
  cache.destroy();
});

test("isStale returns true for an entry beyond staleTime", () => {
  const cache = createTypedFetchCache({ staleTime: 1 });
  const entry = { fetchedAt: Date.now() - 100 };
  assert.equal(cache.isStale(entry), true);
});

// ─── in-flight deduplication ─────────────────────────────────────────────────

test("getInFlight returns undefined when no promise is stored", () => {
  const cache = createTypedFetchCache();
  assert.equal(cache.getInFlight("k1"), undefined);
});

test("setInFlight and getInFlight round-trips a promise", () => {
  const cache = createTypedFetchCache();
  const p = Promise.resolve({ status: 200 });
  cache.setInFlight("k1", p);
  assert.equal(cache.getInFlight("k1"), p);
});

test("clearInFlight removes the stored promise", () => {
  const cache = createTypedFetchCache();
  cache.setInFlight("k1", Promise.resolve());
  cache.clearInFlight("k1");
  assert.equal(cache.getInFlight("k1"), undefined);
});

// ─── subscribe / notify ───────────────────────────────────────────────────────

test("subscribe calls the callback when a key is set", () => {
  const cache = createTypedFetchCache();
  let calls = 0;
  cache.subscribe("k1", () => calls++);
  cache.set("k1", {}, "GET /x");
  assert.ok(calls >= 1);
  cache.destroy();
});

test("unsubscribe stops future notifications", () => {
  const cache = createTypedFetchCache();
  let calls = 0;
  const unsub = cache.subscribe("k1", () => calls++);
  unsub();
  cache.set("k1", {}, "GET /x");
  assert.equal(calls, 0);
  cache.destroy();
});

test("multiple subscribers for the same key all receive notifications", () => {
  const cache = createTypedFetchCache();
  let a = 0,
    b = 0;
  cache.subscribe("k1", () => a++);
  cache.subscribe("k1", () => b++);
  cache.set("k1", {}, "GET /x");
  assert.ok(a >= 1);
  assert.ok(b >= 1);
  cache.destroy();
});

// ─── invalidate ──────────────────────────────────────────────────────────────

test("invalidate removes the entry for the given URL+method", () => {
  const cache = createTypedFetchCache();
  cache.set(cache.buildKey("https://example.com/u", "GET"), {}, "GET /u");
  cache.invalidate("https://example.com/u", "GET");
  assert.equal(
    cache.get(cache.buildKey("https://example.com/u", "GET")),
    undefined,
  );
});

test("invalidate notifies subscribers", () => {
  const cache = createTypedFetchCache();
  const key = cache.buildKey("https://example.com/u", "GET");
  cache.set(key, {}, "GET /u");
  let notified = false;
  cache.subscribe(key, () => (notified = true));
  cache.invalidate("https://example.com/u", "GET");
  assert.equal(notified, true);
});

test("invalidateByEndpoint removes all matching entries", () => {
  const cache = createTypedFetchCache();
  cache.set("k1", {}, "GET /users/:id");
  cache.set("k2", {}, "GET /users/:id");
  cache.set("k3", {}, "POST /users");
  cache.invalidateByEndpoint("GET /users/:id");
  assert.equal(cache.get("k1"), undefined);
  assert.equal(cache.get("k2"), undefined);
  assert.ok(cache.get("k3")); // unrelated entry survives
  cache.destroy();
});

test("invalidateAll clears every entry and in-flight promise", () => {
  const cache = createTypedFetchCache();
  cache.set("k1", {}, "GET /a");
  cache.set("k2", {}, "GET /b");
  cache.setInFlight("k3", Promise.resolve());
  cache.invalidateAll();
  assert.equal(cache.get("k1"), undefined);
  assert.equal(cache.get("k2"), undefined);
  assert.equal(cache.getInFlight("k3"), undefined);
});

// ─── GC timer ────────────────────────────────────────────────────────────────

test("entry is garbage-collected after gcTime expires", async () => {
  const cache = createTypedFetchCache({ gcTime: 30 });
  cache.set("k1", { status: 200 }, "GET /x");
  assert.ok(cache.get("k1"));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(cache.get("k1"), undefined);
});
