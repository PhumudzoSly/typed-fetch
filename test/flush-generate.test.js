const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const { typedFetch } = require("../dist/tFetch");
const { flushObservations, generateTypes } = require("../dist/index");
const { loadRegistry } = require("../dist/core/registry");

function startServer() {
  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: 1, name: "Alice" }));
  });
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind test server"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

test("flushObservations + generateTypes works without CLI", async () => {
  const { server, port } = await startServer();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-flush-"));
  const registryPath = path.join(tempDir, "registry.json");
  const generatedPath = path.join(tempDir, "typed-fetch.d.ts");

  try {
    await typedFetch(`http://127.0.0.1:${port}/users/1`, undefined, {
      endpointKey: "GET /users/:id",
      config: { registryPath, generatedPath },
    });

    // Flush the batched queue synchronously before generating.
    flushObservations();

    const registry = loadRegistry(registryPath);
    assert.ok(registry.endpoints["GET /users/:id"]);

    const result = generateTypes({}, { configPath: undefined });
    // generateTypes reads from the default config path; pass explicit config
    const result2 = generateTypes({ registryPath, generatedPath });
    assert.equal(result2.warnings.length, 0);
    assert.ok(fs.existsSync(generatedPath));
    const dts = fs.readFileSync(generatedPath, "utf8");
    assert.ok(dts.includes("GET /users/:id"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
