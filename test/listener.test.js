const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { startListener } = require("../dist/listener");
const { loadRegistry } = require("../dist/core/registry");

test("listener ingests observation payloads and persists registry", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-listener-"));
  const registryPath = path.join(tempDir, "registry.json");
  const generatedPath = path.join(tempDir, "typed-fetch.d.ts");

  const listener = await startListener({
    port: 0,
    config: { registryPath, generatedPath },
  });

  try {
    const res = await fetch(`http://127.0.0.1:${listener.port}/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "observation",
        observation: {
          endpointKey: "GET /client/items/:param",
          status: 200,
          source: "browser",
          observedAt: new Date().toISOString(),
          shape: {
            kind: "object",
            fields: {
              id: { shape: { kind: "number" } },
              token: { shape: { kind: "string" } },
            },
          },
        },
      }),
    });

    assert.equal(res.status, 202);

    const registry = loadRegistry(registryPath);
    const endpoint = registry.endpoints["GET /client/items/:param"];
    assert.ok(endpoint);
    assert.ok(endpoint.responses["200"]);

    // Listener auto-generates types on sync.
    await new Promise((resolve) => setTimeout(resolve, 260));
    assert.equal(fs.existsSync(generatedPath), true);
  } finally {
    await listener.stop();
  }
});

test("listener rejects non-local origins", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-listener-origin-"));
  const registryPath = path.join(tempDir, "registry.json");

  const listener = await startListener({
    port: 0,
    config: { registryPath },
  });

  try {
    const res = await fetch(`http://127.0.0.1:${listener.port}/sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example.com",
      },
      body: JSON.stringify({
        type: "observation",
        observation: {
          endpointKey: "GET /blocked",
          status: 200,
          source: "node",
          observedAt: new Date().toISOString(),
          shape: { kind: "unknown" },
        },
      }),
    });

    assert.equal(res.status, 403);
  } finally {
    await listener.stop();
  }
});
