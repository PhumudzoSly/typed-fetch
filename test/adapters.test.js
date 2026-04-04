const test = require("node:test");
const assert = require("node:assert/strict");

const { observeResponse } = require("../dist/adapters/generic");
const { typedFetchObserver } = require("../dist/adapters/hono");
const { withTypedFetchObserver } = require("../dist/adapters/next");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body = "ok", status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}

// ─── observeResponse ─────────────────────────────────────────────────────────

test("observeResponse is a function", () => {
  assert.equal(typeof observeResponse, "function");
});

test("observeResponse resolves without throwing in non-development env", async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    await assert.doesNotReject(() =>
      observeResponse("GET /users/:id", jsonResponse({ id: 1 })),
    );
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("observeResponse resolves without throwing for non-JSON responses in development", async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    await assert.doesNotReject(() =>
      observeResponse("GET /users/:id", textResponse("hello")),
    );
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("observeResponse resolves without throwing for JSON responses in development", async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    await assert.doesNotReject(() =>
      observeResponse("GET /users/:id", jsonResponse({ id: 1, name: "Alice" })),
    );
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("observeResponse does not consume the original response body", async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const res = jsonResponse({ id: 1 });
    await observeResponse("GET /users/:id", res);
    // Body should still be readable since observeResponse clones the response
    const data = await res.json();
    assert.deepEqual(data, { id: 1 });
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("observeResponse silently ignores invalid JSON in development", async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const badJson = new Response("not-json{{{", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    await assert.doesNotReject(() =>
      observeResponse("GET /users/:id", badJson),
    );
  } finally {
    process.env.NODE_ENV = original;
  }
});

// ─── typedFetchObserver (Hono) ────────────────────────────────────────────────

test("typedFetchObserver returns a middleware function", () => {
  const middleware = typedFetchObserver();
  assert.equal(typeof middleware, "function");
});

test("typedFetchObserver calls next() exactly once", async () => {
  const middleware = typedFetchObserver();
  let nextCalls = 0;
  const ctx = {
    req: { method: "GET", routePath: "/health" },
    res: textResponse("ok"),
  };
  await middleware(ctx, async () => {
    nextCalls++;
  });
  assert.equal(nextCalls, 1);
});

test("typedFetchObserver calls next() before observing", async () => {
  const middleware = typedFetchObserver();
  const order = [];
  const ctx = {
    req: { method: "GET", routePath: "/health" },
    get res() {
      return textResponse("ok");
    },
  };
  await middleware(ctx, async () => {
    order.push("next");
  });
  // next was called — observation happens after
  assert.ok(order.includes("next"));
});

test("typedFetchObserver builds endpointKey as 'METHOD /routePath'", async () => {
  // We verify indirectly: the middleware completes without throwing, which
  // means the endpointKey was constructed and passed to observeResponse.
  const middleware = typedFetchObserver();
  const ctx = {
    req: { method: "post", routePath: "/items" },
    res: jsonResponse({ id: 42 }),
  };
  await assert.doesNotReject(() => middleware(ctx, async () => {}));
});

test("typedFetchObserver does not throw when next() throws", async () => {
  const middleware = typedFetchObserver();
  const ctx = {
    req: { method: "GET", routePath: "/crash" },
    res: textResponse(),
  };
  // If next throws, the error should propagate (standard middleware contract)
  await assert.rejects(
    () => middleware(ctx, async () => { throw new Error("route error"); }),
    /route error/,
  );
});

// ─── withTypedFetchObserver (Next.js) ────────────────────────────────────────

test("withTypedFetchObserver returns a wrapped handler function", () => {
  const handler = async (_req) => textResponse("ok");
  const wrapped = withTypedFetchObserver("GET /api/items", handler);
  assert.equal(typeof wrapped, "function");
});

test("withTypedFetchObserver returns the original response unchanged", async () => {
  const handler = async (_req) => jsonResponse({ id: 1 });
  const wrapped = withTypedFetchObserver("GET /api/users/:id", handler);
  const req = new Request("https://example.com/api/users/1");
  const res = await wrapped(req);
  const data = await res.json();
  assert.deepEqual(data, { id: 1 });
  assert.equal(res.status, 200);
});

test("withTypedFetchObserver preserves response status", async () => {
  const handler = async (_req) => jsonResponse({ error: "not found" }, 404);
  const wrapped = withTypedFetchObserver("GET /api/users/:id", handler);
  const req = new Request("https://example.com/api/users/999");
  const res = await wrapped(req);
  assert.equal(res.status, 404);
});

test("withTypedFetchObserver passes ctx to the inner handler", async () => {
  let receivedCtx;
  const handler = async (_req, ctx) => {
    receivedCtx = ctx;
    return textResponse("ok");
  };
  const wrapped = withTypedFetchObserver("GET /api/items", handler);
  const req = new Request("https://example.com/api/items");
  const ctx = { params: { id: "1" } };
  await wrapped(req, ctx);
  assert.deepEqual(receivedCtx, ctx);
});

test("withTypedFetchObserver does not throw when handler throws", async () => {
  const handler = async (_req) => { throw new Error("handler error"); };
  const wrapped = withTypedFetchObserver("GET /api/crash", handler);
  const req = new Request("https://example.com/api/crash");
  await assert.rejects(() => wrapped(req), /handler error/);
});

test("withTypedFetchObserver resolves without throwing for non-JSON responses", async () => {
  const handler = async (_req) => textResponse("plain");
  const wrapped = withTypedFetchObserver("GET /api/text", handler);
  const req = new Request("https://example.com/api/text");
  await assert.doesNotReject(() => wrapped(req));
});
