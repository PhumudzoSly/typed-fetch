const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const { typedFetch, typedJsonBody } = require("../dist/tFetch");
const { loadRegistry } = require("../dist/core/registry");
const { startListener } = require("../dist/listener");

function startServer() {
  let latestPostedTodo = null;
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

    if (req.url === "/todos" && req.method === "POST") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += String(chunk);
      });
      req.on("end", () => {
        latestPostedTodo = JSON.parse(raw);
        res.statusCode = 201;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      });
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
      resolve({
        server,
        port: address.port,
        getLatestPostedTodo: () => latestPostedTodo,
      });
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

test("typedFetch auto-stringifies plain JSON body values", async () => {
  const { server, port, getLatestPostedTodo } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await typedFetch(
      `${baseUrl}/todos`,
      {
        method: "POST",
        body: { title: "Write tests", done: false },
      },
      { endpointKey: "POST /todos" },
    );

    assert.equal(result.status, 201);
    assert.deepEqual(getLatestPostedTodo(), { title: "Write tests", done: false });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("typedFetch JSON-stringifies string body values", async () => {
  const { server, port, getLatestPostedTodo } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await typedFetch(
      `${baseUrl}/todos`,
      {
        method: "POST",
        body: "plain-string",
      },
      { endpointKey: "POST /todos" },
    );

    assert.equal(result.status, 201);
    assert.equal(getLatestPostedTodo(), "plain-string");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("typedJsonBody sets content-type and serializes payload", async () => {
  const { server, port, getLatestPostedTodo } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await typedFetch(
      `${baseUrl}/todos`,
      {
        method: "POST",
        ...typedJsonBody({ title: "Use helper" }),
      },
      { endpointKey: "POST /todos" },
    );

    assert.equal(result.status, 201);
    assert.deepEqual(getLatestPostedTodo(), { title: "Use helper" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("typedFetch pushes observations to sync listener", async () => {
  const { server, port } = await startServer();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-sync-"));
  const collectorRegistryPath = path.join(tempDir, "collector-registry.json");
  const collector = await startListener({
    port: 0,
    config: { registryPath: collectorRegistryPath },
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const syncUrl = `http://127.0.0.1:${collector.port}/sync`;
  const registryPath = path.join(tempDir, "local-registry.json");
  const generatedPath = path.join(tempDir, "typed-fetch.d.ts");

  try {
    await typedFetch(`${baseUrl}/users/1`, undefined, {
      endpointKey: "GET /users/:param",
      config: {
        observerMode: "none",
        syncUrl,
        registryPath,
        generatedPath,
      },
    });

    // Give async push a brief moment to complete.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const registry = loadRegistry(collectorRegistryPath);
    assert.ok(registry.endpoints["GET /users/:param"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await collector.stop();
  }
});
