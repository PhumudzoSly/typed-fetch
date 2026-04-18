/**
 * Tests for src/core/http-observer-server.ts
 *
 * Starts the server on an ephemeral port and sends real HTTP requests to
 * verify status codes, CORS headers, input validation (Fix 3), and the
 * 1 MB body limit guard.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const { createObserverServer } = require("../dist/core/http-observer-server");
const { loadRegistry } = require("../dist/core/registry");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempRegistry() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tfetch-server-test-"));
  return path.join(tempDir, "registry.json");
}

function startServer(registryPath, onObservation = () => {}) {
  const server = createObserverServer(registryPath, onObservation);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind"));
        return;
      }
      resolve({ server, base: `http://127.0.0.1:${addr.port}` });
    });
    server.on("error", reject);
  });
}

function request(
  base,
  {
    method = "POST",
    path: urlPath = "/__typed-fetch/observe",
    body,
    headers = {},
  } = {},
) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, base);
    const bodyBuf =
      body !== undefined
        ? Buffer.from(typeof body === "string" ? body : JSON.stringify(body))
        : undefined;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: { "content-type": "application/json", ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data }),
        );
      },
    );
    req.on("error", reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

const validShape = {
  kind: "object",
  fields: { id: { shape: { kind: "number" } } },
};
const validPayload = {
  endpointKey: "GET /items/:id",
  status: 200,
  shape: validShape,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

test("OPTIONS preflight returns 204 with CORS headers", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    const res = await request(base, { method: "OPTIONS" });
    assert.equal(res.status, 204);
    assert.equal(res.headers["access-control-allow-origin"], "*");
    assert.ok(res.headers["access-control-allow-methods"].includes("POST"));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST valid payload returns 204 and writes to registry", async () => {
  const registryPath = makeTempRegistry();
  let observationCallCount = 0;
  const { server, base } = await startServer(registryPath, () => {
    observationCallCount++;
  });
  try {
    const res = await request(base, { body: validPayload });
    assert.equal(res.status, 204, "valid payload should return 204");
    assert.equal(
      observationCallCount,
      1,
      "onObservation callback should be called once",
    );

    const registry = loadRegistry(registryPath);
    assert.ok(
      registry.endpoints["GET /items/:id"],
      "endpoint should be recorded in registry",
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST with missing endpointKey returns 400", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    const res = await request(base, {
      body: { status: 200, shape: validShape },
    });
    assert.equal(res.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST with empty string endpointKey returns 400", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    const res = await request(base, {
      body: { endpointKey: "", status: 200, shape: validShape },
    });
    assert.equal(res.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST with status as a string returns 400", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    const res = await request(base, {
      body: { endpointKey: "GET /items/:id", status: "200", shape: validShape },
    });
    assert.equal(res.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST with null shape returns 400", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    const res = await request(base, {
      body: { endpointKey: "GET /items/:id", status: 200, shape: null },
    });
    assert.equal(res.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST with non-JSON body returns 400", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    const res = await request(base, { body: "not-json" });
    assert.equal(res.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST to unknown route returns 404", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    const res = await request(base, {
      path: "/unknown-route",
      body: validPayload,
    });
    assert.equal(res.status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("POST body larger than 1 MB returns 413", async () => {
  const registryPath = makeTempRegistry();
  const { server, base } = await startServer(registryPath);
  try {
    // Build a payload just over 1 MB.
    const oversizedShape = {
      kind: "object",
      fields: { data: { shape: { kind: "string" } } },
    };
    const bigString = "x".repeat(1_048_577);
    const bigBody = JSON.stringify({
      endpointKey: "GET /big",
      status: 200,
      shape: oversizedShape,
      extra: bigString,
    });

    const res = await new Promise((resolve, _reject) => {
      const url = new URL("/__typed-fetch/observe", base);
      const bodyBuf = Buffer.from(bigBody);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": bodyBuf.length,
          },
        },
        (innerRes) => {
          let data = "";
          innerRes.on("data", (c) => {
            data += c;
          });
          innerRes.on("end", () =>
            resolve({ status: innerRes.statusCode, body: data }),
          );
          innerRes.resume(); // drain
        },
      );
      req.on("error", () => resolve({ status: 0 })); // connection reset is also acceptable
      req.write(bodyBuf);
      req.end();
    });

    // Accept either 413 (proper response) or 0 (connection reset mid-stream).
    assert.ok(
      res.status === 413 || res.status === 0,
      `expected 413 or connection reset, got ${res.status}`,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
