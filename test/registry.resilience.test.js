const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { coerceRegistry, loadRegistry } = require("../dist/core/registry");

test("loadRegistry backs up corrupt registry files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-corrupt-"));
  const registryPath = path.join(tempDir, "registry.json");
  fs.writeFileSync(registryPath, "{ broken json", "utf8");

  const registry = loadRegistry(registryPath);
  assert.equal(registry.version, 2);
  assert.deepEqual(registry.endpoints, {});

  const files = fs.readdirSync(tempDir);
  assert.equal(files.some((file) => file.includes(".invalid-") && file.endsWith(".bak")), true);
});

test("coerceRegistry migrates older registries and drops invalid shapes", () => {
  const migrated = coerceRegistry({
    version: 1,
    endpoints: {
      "GET /users/:param": {
        responses: {
          "200": {
            kind: "object",
            fields: {
              id: { shape: { kind: "number" } },
            },
          },
          "500": {
            kind: "not-a-real-shape",
          },
        },
        meta: {
          seenCount: 3,
          lastSeenAt: "2026-02-20T12:00:00.000Z",
          observedPaths: ["/users/1", "/users/1", 9],
        },
      },
    },
  });

  assert.equal(migrated.version, 2);
  assert.ok(migrated.endpoints["GET /users/:param"]);
  assert.ok(migrated.endpoints["GET /users/:param"].responses["200"]);
  assert.equal(migrated.endpoints["GET /users/:param"].responses["500"], undefined);
  assert.deepEqual(migrated.endpoints["GET /users/:param"].meta.observedPaths, ["/users/1"]);
});
