const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createTypedFetchClient } = require("../dist/index");

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/users/1") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: 1, name: "Alice" }));
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
        reject(new Error("Failed to bind"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

test("createTypedFetchClient prepends baseUrl to path", async () => {
  const { server, port } = await startServer();
  const client = createTypedFetchClient({
    baseUrl: `http://127.0.0.1:${port}`,
    config: { observerMode: "none" },
  });

  try {
    const result = await client.fetch("/users/1", undefined, {
      endpointKey: "GET /users/:id",
    });
    assert.equal(result.status, 200);
    assert.equal(result.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("createTypedFetchClient strips trailing slash from baseUrl", async () => {
  const { server, port } = await startServer();
  const client = createTypedFetchClient({
    baseUrl: `http://127.0.0.1:${port}/`, // trailing slash
    config: { observerMode: "none" },
  });

  try {
    const result = await client.fetch("/users/1", undefined, {
      endpointKey: "GET /users/:id",
    });
    assert.equal(result.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("createTypedFetchClient adds leading slash to path if missing", async () => {
  const { server, port } = await startServer();
  const client = createTypedFetchClient({
    baseUrl: `http://127.0.0.1:${port}`,
    config: { observerMode: "none" },
  });

  try {
    const result = await client.fetch("users/1", undefined, {
      // no leading slash
      endpointKey: "GET /users/:id",
    });
    assert.equal(result.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("createTypedFetchClient returns TypedFetchNetworkError on connection failure", async () => {
  const client = createTypedFetchClient({
    baseUrl: "http://127.0.0.1:1",
    config: { observerMode: "none" },
  });

  const result = await client.fetch("/users/1", undefined, {
    endpointKey: "GET /users/:id",
  });

  assert.equal(result.status, 0);
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof Error);
});

test("createTypedFetchClient merges client config with per-request config", async () => {
  const { server, port } = await startServer();
  const client = createTypedFetchClient({
    baseUrl: `http://127.0.0.1:${port}`,
    config: { observerMode: "none", maxDepth: 4 },
  });

  try {
    // Per-request config should override client config
    const result = await client.fetch("/users/1", undefined, {
      endpointKey: "GET /users/:id",
      config: { maxDepth: 2 },
    });
    assert.equal(result.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
