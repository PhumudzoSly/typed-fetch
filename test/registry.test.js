const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { inferShape } = require("../dist/core/shape");
const { loadRegistry, observeShape, saveRegistry } = require("../dist/core/registry");

const baseConfig = {
  maxDepth: 8,
  maxArraySample: 32,
  ignoreFieldNames: ["password", "token", "secret", "authorization"],
};

test("persists merged status buckets without raw values", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-registry-"));
  const registryPath = path.join(tempDir, "registry.json");

  const registry = loadRegistry(registryPath);

  observeShape({
    registry,
    endpointKey: "GET /users/:param",
    status: 200,
    shape: inferShape({ id: 1, email: "alice@example.com" }, baseConfig),
  });
  observeShape({
    registry,
    endpointKey: "GET /users/:param",
    status: 404,
    shape: inferShape({ message: "missing-user" }, baseConfig),
  });

  saveRegistry(registryPath, registry);

  const raw = fs.readFileSync(registryPath, "utf8");
  const parsed = JSON.parse(raw);

  assert.equal(parsed.version, 1);
  assert.ok(parsed.endpoints["GET /users/:param"].responses["200"]);
  assert.ok(parsed.endpoints["GET /users/:param"].responses["404"]);
  assert.equal(raw.includes("alice@example.com"), false);
  assert.equal(raw.includes("missing-user"), false);
});

