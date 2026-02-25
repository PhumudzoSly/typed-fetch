const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const { typedFetch } = require("../dist/tFetch");
const { loadRegistry } = require("../dist/core/registry");

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith("/concurrency/") && req.method === "GET") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, id: Number(req.url.split("/").pop()) || 0 }));
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ message: "Not Found" }));
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind server"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

test("typedFetch file observer preserves high-volume observations", async () => {
  const { server, port } = await startServer();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-concurrency-"));
  const registryPath = path.join(tempDir, "registry.json");
  const generatedPath = path.join(tempDir, "typed-fetch.d.ts");

  try {
    const requests = Array.from({ length: 60 }).map((_, index) =>
      typedFetch(`http://127.0.0.1:${port}/concurrency/${index}`, undefined, {
        endpointKey: "GET /concurrency/:param",
        config: {
          registryPath,
          generatedPath,
        },
      })
    );

    await Promise.all(requests);

    // Observer queue flushes asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 140));

    const registry = loadRegistry(registryPath);
    const endpoint = registry.endpoints["GET /concurrency/:param"];
    assert.ok(endpoint);
    assert.ok(endpoint.responses["200"]);
    assert.equal(endpoint.meta.seenCount, 60);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
