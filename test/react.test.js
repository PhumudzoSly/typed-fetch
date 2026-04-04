/**
 * Tests for src/react.ts
 *
 * Uses react-test-renderer (no DOM/jsdom needed) so it runs with the
 * project's existing `node --test` setup.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const React = require("react");
const { act, create } = require("react-test-renderer");

// ─── Local test server ────────────────────────────────────────────────────────

function startServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind test server"));
        return;
      }
      resolve({ server, port: addr.port, base: `http://127.0.0.1:${addr.port}` });
    });
    server.on("error", reject);
  });
}

const {
  TypedFetchProvider,
  useTypedFetch,
  useTypedMutation,
} = require("../dist/react");
const { createTypedFetchCache } = require("../dist/cache");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Run a hook inside a minimal React component and return the latest value.
 * Re-renders are triggered by calling `rerender()`.
 */
function renderHook(useHook) {
  let result;
  let renderer;

  function Wrapper() {
    result = useHook();
    return null;
  }

  act(() => {
    renderer = create(React.createElement(Wrapper));
  });

  return {
    get result() {
      return result;
    },
    rerender() {
      act(() => renderer.update(React.createElement(Wrapper)));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

/**
 * Run a hook inside a TypedFetchProvider wrapper.
 */
function renderHookWithCache(useHook, cache) {
  let result;
  let renderer;

  function Inner() {
    result = useHook();
    return null;
  }

  function Wrapper() {
    return React.createElement(TypedFetchProvider, { cache }, React.createElement(Inner));
  }

  act(() => {
    renderer = create(React.createElement(Wrapper));
  });

  return {
    get result() {
      return result;
    },
    rerender() {
      act(() => renderer.update(React.createElement(Wrapper)));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

// ─── Module exports ───────────────────────────────────────────────────────────

test("TypedFetchProvider is exported as a function", () => {
  assert.equal(typeof TypedFetchProvider, "function");
});

test("useTypedFetch is exported as a function", () => {
  assert.equal(typeof useTypedFetch, "function");
});

test("useTypedMutation is exported as a function", () => {
  assert.equal(typeof useTypedMutation, "function");
});

// ─── TypedFetchProvider ───────────────────────────────────────────────────────

test("TypedFetchProvider renders children without throwing", () => {
  const cache = createTypedFetchCache();
  let renderer;
  assert.doesNotThrow(() => {
    act(() => {
      renderer = create(
        React.createElement(
          TypedFetchProvider,
          { cache },
          React.createElement("div", null, "hello"),
        ),
      );
    });
  });
  const json = renderer.toJSON();
  assert.equal(json.type, "div");
  assert.deepEqual(json.children, ["hello"]);
  act(() => renderer.unmount());
  cache.destroy();
});

// ─── useTypedFetch — error without cache ─────────────────────────────────────

test("useTypedFetch throws when no cache is provided via context or options", () => {
  function useNoCache() {
    return useTypedFetch("https://example.com/users", undefined, {
      endpointKey: "GET /users",
    });
  }

  assert.throws(() => {
    act(() => {
      create(React.createElement(function () {
        useNoCache();
        return null;
      }));
    });
  }, /TypedFetchCache/);
});

// ─── useTypedFetch — basic states ────────────────────────────────────────────

test("useTypedFetch returns isLoading: true initially when no cached data", async () => {
  // Use a server that hangs so the hook stays in loading state long enough to assert.
  const { server, base } = await startServer((_req, _res) => { /* intentionally hangs */ });
  const cache = createTypedFetchCache();

  try {
    const { result, unmount } = renderHookWithCache(
      () =>
        useTypedFetch(`${base}/users`, undefined, {
          endpointKey: "GET /users",
        }),
      cache,
    );

    // Immediately after mount the fetch is in-flight — no result yet.
    assert.equal(result.isLoading, true);
    assert.equal(result.result, undefined);
    assert.equal(result.isSuccess, false);
    assert.equal(result.isError, false);
    unmount();
  } finally {
    cache.destroy();
    await new Promise((r) => server.close(r));
  }
});

test("useTypedFetch returns isLoading: false when enabled is false", () => {
  const cache = createTypedFetchCache();

  const { result, unmount } = renderHookWithCache(
    () =>
      useTypedFetch("https://example.com/users", undefined, {
        endpointKey: "GET /users",
        enabled: false,
      }),
    cache,
  );

  assert.equal(result.isLoading, false);
  unmount();
  cache.destroy();
});

test("useTypedFetch serves initialData without a network call when enabled:false", () => {
  const cache = createTypedFetchCache({ staleTime: 60_000 });
  const initialData = { status: 200, ok: true, data: { id: 1 }, response: null, endpoint: "GET /users" };

  // enabled:false means no fetch is issued regardless of the URL.
  const { result, unmount } = renderHookWithCache(
    () =>
      useTypedFetch("https://example.com/users", undefined, {
        endpointKey: "GET /users",
        initialData,
        enabled: false,
      }),
    cache,
  );

  assert.equal(result.isLoading, false);
  unmount();
  cache.destroy();
});

test("useTypedFetch exposes refetch, invalidate, and invalidateEndpoint as functions", () => {
  const cache = createTypedFetchCache();
  const { result, unmount } = renderHookWithCache(
    () =>
      useTypedFetch("https://example.com/users", undefined, {
        endpointKey: "GET /users",
        enabled: false,
      }),
    cache,
  );

  assert.equal(typeof result.refetch, "function");
  assert.equal(typeof result.invalidate, "function");
  assert.equal(typeof result.invalidateEndpoint, "function");
  unmount();
  cache.destroy();
});

test("useTypedFetch returns cached result as isSuccess when data is in cache", () => {
  const cache = createTypedFetchCache({ staleTime: 60_000 });
  const key = cache.buildKey("https://example.com/users", "GET");
  const fakeResult = { status: 200, ok: true, data: [{ id: 1 }], response: null, endpoint: "GET /users" };
  cache.set(key, fakeResult, "GET /users");

  const { result, unmount } = renderHookWithCache(
    () =>
      useTypedFetch("https://example.com/users", undefined, {
        endpointKey: "GET /users",
      }),
    cache,
  );

  assert.equal(result.isLoading, false);
  assert.equal(result.isSuccess, true);
  assert.deepEqual(result.result, fakeResult);
  unmount();
  cache.destroy();
});

test("useTypedFetch select transforms the result", () => {
  const cache = createTypedFetchCache({ staleTime: 60_000 });
  const key = cache.buildKey("https://example.com/users", "GET");
  const fakeResult = { status: 200, ok: true, data: [{ id: 1 }, { id: 2 }], response: null, endpoint: "GET /users" };
  cache.set(key, fakeResult, "GET /users");

  const { result, unmount } = renderHookWithCache(
    () =>
      useTypedFetch("https://example.com/users", undefined, {
        endpointKey: "GET /users",
        select: (r) => (r.ok ? r.data.length : 0),
      }),
    cache,
  );

  assert.equal(result.result, 2);
  unmount();
  cache.destroy();
});

// ─── useTypedMutation ─────────────────────────────────────────────────────────

test("useTypedMutation initial state is idle", () => {
  const { result, unmount } = renderHook(() =>
    useTypedMutation({ endpointKey: "POST /users" }),
  );

  assert.equal(result.isLoading, false);
  assert.equal(result.isSuccess, false);
  assert.equal(result.isError, false);
  assert.equal(result.result, undefined);
  assert.equal(result.error, undefined);
  unmount();
});

test("useTypedMutation exposes mutate, mutateAsync, and reset as functions", () => {
  const { result, unmount } = renderHook(() =>
    useTypedMutation({ endpointKey: "POST /users" }),
  );

  assert.equal(typeof result.mutate, "function");
  assert.equal(typeof result.mutateAsync, "function");
  assert.equal(typeof result.reset, "function");
  unmount();
});

test("useTypedMutation reset returns to idle state", async () => {
  const { server, base } = await startServer((_req, res) => {
    res.statusCode = 201;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: 1 }));
  });

  let hookResult;
  const renderer = { current: null };

  function Inner() {
    hookResult = useTypedMutation({ endpointKey: "POST /users" });
    return null;
  }

  act(() => {
    renderer.current = create(React.createElement(Inner));
  });

  // Trigger mutation and wait for it
  await act(async () => {
    await hookResult.mutateAsync(`${base}/users`, {
      method: "POST",
      body: JSON.stringify({ name: "Alice" }),
    });
  });

  assert.ok(hookResult.result !== undefined);

  // Reset
  act(() => hookResult.reset());
  assert.equal(hookResult.result, undefined);
  assert.equal(hookResult.isLoading, false);
  assert.equal(hookResult.isSuccess, false);

  act(() => renderer.current.unmount());
  await new Promise((r) => server.close(r));
});

test("useTypedMutation calls onSuccess callback after a successful mutation", async () => {
  const { server, base } = await startServer((_req, res) => {
    res.statusCode = 201;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: 1 }));
  });

  let successResult;
  let hookResult;
  const renderer = { current: null };

  function Inner() {
    hookResult = useTypedMutation({
      endpointKey: "POST /users",
      onSuccess: (r) => { successResult = r; },
    });
    return null;
  }

  act(() => {
    renderer.current = create(React.createElement(Inner));
  });

  await act(async () => {
    await hookResult.mutateAsync(`${base}/users`, { method: "POST" });
  });

  assert.ok(successResult !== undefined, "onSuccess should have been called");
  assert.equal(successResult.status, 201);

  act(() => renderer.current.unmount());
  await new Promise((r) => server.close(r));
});
