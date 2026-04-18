/**
 * Tests for src/core/file-observer.ts
 *
 * Covers batching, force-flush at 20 items, manual flush, and post-flush
 * map cleanup (Fix 8).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { queueRegistryObservation, flushAllRegistryObservationQueues } =
  require("../dist/core/file-observer");
const { loadRegistry } = require("../dist/core/registry");

function makeTempRegistry() {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tfetch-observer-test-"),
  );
  return path.join(tempDir, "registry.json");
}

const dummyShape = {
  kind: "object",
  fields: { id: { shape: { kind: "number" } } },
};

function makeObs(n = 0) {
  return {
    endpointKey: `GET /items/${n}`,
    status: 200,
    shape: dummyShape,
  };
}

test("queued observations are written to registry after manual flush", () => {
  const registryPath = makeTempRegistry();

  queueRegistryObservation({
    registryPath,
    observation: makeObs(1),
    flushDelayMs: 10_000,
  });
  queueRegistryObservation({
    registryPath,
    observation: makeObs(2),
    flushDelayMs: 10_000,
  });

  // Registry should not exist yet (timer hasn't fired, no force-flush).
  // Manual flush writes everything synchronously.
  flushAllRegistryObservationQueues();

  const registry = loadRegistry(registryPath);
  assert.ok(
    registry.endpoints["GET /items/1"],
    "endpoint 1 should be recorded",
  );
  assert.ok(
    registry.endpoints["GET /items/2"],
    "endpoint 2 should be recorded",
  );
});

test("queued observations are batched into a single registry write", () => {
  const registryPath = makeTempRegistry();

  // Queue three observations with a long delay so they stay queued.
  for (let i = 0; i < 3; i++) {
    queueRegistryObservation({
      registryPath,
      observation: makeObs(i + 10),
      flushDelayMs: 10_000,
    });
  }

  flushAllRegistryObservationQueues();

  const registry = loadRegistry(registryPath);
  // All three should be in one registry write (seenCount 1 each, not 3 total).
  for (let i = 0; i < 3; i++) {
    const ep = registry.endpoints[`GET /items/${i + 10}`];
    assert.ok(ep, `endpoint ${i + 10} should be present`);
    assert.equal(ep.meta.seenCount, 1);
  }
});

test("force-flush fires immediately when queue reaches 20 items", () => {
  const registryPath = makeTempRegistry();

  // Push exactly 20 items — the 20th triggers an immediate synchronous flush.
  for (let i = 0; i < 20; i++) {
    queueRegistryObservation({
      registryPath,
      observation: makeObs(i + 100),
      flushDelayMs: 10_000,
    });
  }

  // Registry should already be written without needing a manual flush.
  const registry = loadRegistry(registryPath);
  assert.equal(
    Object.keys(registry.endpoints).length,
    20,
    "all 20 endpoints should be flushed",
  );
});

test("flushAllRegistryObservationQueues is idempotent — second call is a no-op", () => {
  const registryPath = makeTempRegistry();

  queueRegistryObservation({
    registryPath,
    observation: makeObs(200),
    flushDelayMs: 10_000,
  });
  flushAllRegistryObservationQueues(); // First flush — writes registry.
  flushAllRegistryObservationQueues(); // Second flush — should not corrupt.

  const registry = loadRegistry(registryPath);
  assert.ok(
    registry.endpoints["GET /items/200"],
    "endpoint should still be present after double flush",
  );
  assert.equal(
    registry.endpoints["GET /items/200"].meta.seenCount,
    1,
    "seenCount must not be incremented by no-op flush",
  );
});

test("multiple different registry paths are flushed independently", () => {
  const pathA = makeTempRegistry();
  const pathB = makeTempRegistry();

  queueRegistryObservation({
    registryPath: pathA,
    observation: { endpointKey: "GET /a", status: 200, shape: dummyShape },
    flushDelayMs: 10_000,
  });
  queueRegistryObservation({
    registryPath: pathB,
    observation: { endpointKey: "GET /b", status: 200, shape: dummyShape },
    flushDelayMs: 10_000,
  });

  flushAllRegistryObservationQueues();

  const regA = loadRegistry(pathA);
  const regB = loadRegistry(pathB);
  assert.ok(regA.endpoints["GET /a"], "path A should have GET /a");
  assert.equal(
    regA.endpoints["GET /b"],
    undefined,
    "path A should NOT have GET /b",
  );
  assert.ok(regB.endpoints["GET /b"], "path B should have GET /b");
  assert.equal(
    regB.endpoints["GET /a"],
    undefined,
    "path B should NOT have GET /a",
  );
});
