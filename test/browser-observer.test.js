const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { typedFetch } = require("../dist/tFetch");
const { loadBrowserRegistry, clearBrowserRegistry } = require("../dist/core/browser-registry");

function createStorageMock() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/browser/123" && req.method === "GET") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: 123, name: "Browser User", token: "x" }));
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
        reject(new Error("Failed to bind test server"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

test("localStorage observer mode captures shapes without filesystem", async () => {
  const storageKey = "__typed_fetch_registry_test__";
  const originalStorage = global.localStorage;
  global.localStorage = createStorageMock();

  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    clearBrowserRegistry(storageKey);
    const result = await typedFetch(`${baseUrl}/browser/123`, undefined, {
      endpointKey: "GET /browser/:param",
      config: {
        observerMode: "localStorage",
        browserStorageKey: storageKey,
      },
    });

    assert.equal(result.status, 200);
    const registry = loadBrowserRegistry(storageKey);
    const endpoint = registry.endpoints["GET /browser/:param"];
    assert.ok(endpoint);
    assert.ok(endpoint.responses["200"]);
    assert.equal(endpoint.responses["200"].fields.token, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalStorage === undefined) {
      delete global.localStorage;
    } else {
      global.localStorage = originalStorage;
    }
  }
});
