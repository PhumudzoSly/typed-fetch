const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const { typedFetch } = require("../dist/tFetch");
const { loadRegistry } = require("../dist/core/registry");
const { flushObservations, generateTypes, checkTypes } = require("../dist/index");

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/users/1" && req.method === "GET") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: 1, name: "Alice", token: "secret-token" }));
      return;
    }

    if (req.url === "/users/2" && req.method === "GET") {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ message: "Not Found" }));
      return;
    }

    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Unhandled" }));
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

test("typedFetch captures status-aware shapes and strips ignored field names", async () => {
  const { server, port } = await startServer();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-int-"));
  const registryPath = path.join(tempDir, "registry.json");
  const generatedPath = path.join(tempDir, "typed-fetch.d.ts");
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const ok = await typedFetch(`${baseUrl}/users/1`, undefined, {
      endpointKey: "GET /users/:param",
      config: { registryPath, generatedPath },
    });
    const notFound = await typedFetch(`${baseUrl}/users/2`, undefined, {
      endpointKey: "GET /users/:param",
      config: { registryPath, generatedPath },
    });

    assert.equal(ok.status, 200);
    assert.equal(ok.ok, true);
    assert.equal(notFound.status, 404);
    assert.equal(notFound.ok, false);

    // File observer mode batches writes briefly before flushing.
    await new Promise((resolve) => setTimeout(resolve, 80));

    const registry = loadRegistry(registryPath);
    const bucket = registry.endpoints["GET /users/:param"];
    assert.ok(bucket);
    assert.ok(bucket.responses["200"]);
    assert.ok(bucket.responses["404"]);

    const fields200 = bucket.responses["200"].fields;
    assert.ok(fields200.id);
    assert.ok(fields200.name);
    assert.equal(fields200.token, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("full pipeline: observe → registry → generate → check produces valid .d.ts", async () => {
  const { server, port } = await startServer();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-pipeline-"));
  const registryPath = path.join(tempDir, "registry.json");
  const generatedPath = path.join(tempDir, "typed-fetch.d.ts");
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await typedFetch(`${baseUrl}/users/1`, undefined, {
      endpointKey: "GET /users/:param",
      config: { registryPath, generatedPath },
    });

    flushObservations();

    const result = generateTypes({ registryPath, generatedPath });
    assert.equal(result.warnings.length, 0);
    assert.ok(fs.existsSync(generatedPath));

    const dts = fs.readFileSync(generatedPath, "utf8");
    assert.ok(dts.includes("GET /users/:param"));
    assert.ok(dts.includes("200:"));
    assert.ok(dts.includes('"id"'));
    assert.ok(dts.includes('"name"'));

    const check = checkTypes({ registryPath, generatedPath });
    assert.equal(check.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("typedFetch returns TypedFetchNetworkError on connection failure", async () => {
  const result = await typedFetch("http://127.0.0.1:1", undefined, {
    endpointKey: "GET /unreachable",
    config: { observerMode: "none" },
  });

  assert.equal(result.status, 0);
  assert.equal(result.ok, false);
  assert.equal(result.data, undefined);
  assert.equal(result.response, null);
  assert.ok(result.error instanceof Error);
});

