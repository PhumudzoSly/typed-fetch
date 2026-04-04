/**
 * typed-fetch v0.2 — React Hooks + Cache Demo
 *
 * Demonstrates:
 *  - TypedFetchProvider + createTypedFetchCache (see main.tsx)
 *  - useTypedFetch with type-safe endpoint keys (TypedFetchUserEndpoints in endpoints.d.ts)
 *  - useTypedMutation for POST requests
 *  - keepPreviousData for seamless user switching
 *  - refetch / invalidate / invalidateEndpoint from hook return values
 *  - cache.invalidateAll() for a full reset
 *  - Generic adapter code pattern (shown in the Cache tab)
 */

import { useState } from "react";
import { useTypedFetch, useTypedMutation } from "@phumudzo/typed-fetch/react";
import { cache } from "./main";
import "./App.css";

const BASE = "https://jsonplaceholder.typicode.com";

type Tab = "posts" | "create" | "cache";

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<Tab>("posts");

  return (
    <main className="app">
      <header className="header">
        <p className="eyebrow">typed-fetch v0.2 · Vite + React</p>
        <h1>React Hooks + Cache Demo</h1>
        <p className="lead">
          Live demo of <code>useTypedFetch</code>, <code>useTypedMutation</code>,{" "}
          <code>TypedFetchProvider</code>, and cache invalidation using the{" "}
          <a href="https://jsonplaceholder.typicode.com" target="_blank" rel="noreferrer">
            JSONPlaceholder
          </a>{" "}
          public API.
        </p>
        <nav className="tabs">
          {(["posts", "create", "cache"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tab ${tab === t ? "tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "posts" ? "📄 Posts" : t === "create" ? "✏️ Create" : "🗄️ Cache"}
            </button>
          ))}
        </nav>
      </header>

      <div className="content">
        {tab === "posts"  && <PostsTab />}
        {tab === "create" && <CreateTab />}
        {tab === "cache"  && <CacheTab />}
      </div>
    </main>
  );
}

// ─── Posts Tab ────────────────────────────────────────────────────────────────

function PostsTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // List of posts — type-safe via TypedFetchUserEndpoints
  const {
    result: listResult,
    isLoading: listLoading,
    isFetching: listFetching,
    refetch: refetchList,
  } = useTypedFetch(`${BASE}/posts`, undefined, {
    endpointKey: "GET /posts",
  });

  // Post detail — only fetches when a post is selected; keeps previous post
  // data visible while the new one loads (keepPreviousData).
  const {
    result: detailResult,
    isLoading: detailLoading,
    invalidate: invalidateDetail,
  } = useTypedFetch(`${BASE}/posts/${selectedId ?? 1}`, undefined, {
    endpointKey: "GET /posts/:id",
    enabled: selectedId !== null,
    keepPreviousData: true,
  });

  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Posts List</h2>
          <div className="badge-row">
            {listFetching && <span className="badge badge--blue">fetching…</span>}
            <button type="button" className="btn btn--sm" onClick={refetchList}>
              Refetch
            </button>
          </div>
        </div>
        {listLoading && <p className="muted">Loading posts…</p>}
        {listResult?.status === 200 && (
          <ul className="post-list">
            {listResult.data.slice(0, 10).map((post) => (
              <li
                key={post.id}
                className={`post-item ${selectedId === post.id ? "post-item--active" : ""}`}
                onClick={() => setSelectedId(post.id)}
              >
                <span className="post-id">#{post.id}</span>
                <span className="post-title">{post.title}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">
          Hover <code>post.title</code> or <code>post.userId</code> in your editor
          to see the inferred types from <code>endpoints.d.ts</code>.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Post Detail</h2>
          {selectedId !== null && (
            <div className="badge-row">
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={invalidateDetail}
              >
                Invalidate
              </button>
            </div>
          )}
        </div>
        {selectedId === null && <p className="muted">Click a post to view it.</p>}
        {selectedId !== null && detailLoading && (
          <p className="muted">Loading post #{selectedId}…</p>
        )}
        {detailResult?.status === 200 && (
          <article className="post-detail">
            <h3>{detailResult.data.title}</h3>
            <p>{detailResult.data.body}</p>
            <p className="muted">
              Post ID: {detailResult.data.id} · User ID: {detailResult.data.userId}
            </p>
          </article>
        )}
      </section>
    </div>
  );
}

// ─── Create Tab ───────────────────────────────────────────────────────────────

function CreateTab() {
  const { mutate, isLoading, isSuccess, isError, error, result, reset } =
    useTypedMutation({
      endpointKey: "POST /posts",
      onSuccess: () => {
        // Invalidate the posts list so it refetches next time it's viewed
        cache.invalidateByEndpoint("GET /posts");
      },
      onError: (err) => console.error("Network error:", err.error.message),
    });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate(`${BASE}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title") as string,
        body: fd.get("body") as string,
        userId: 1,
      }),
    });
  }

  return (
    <section className="panel">
      <h2>Create Post</h2>
      <p className="muted">
        Uses <code>useTypedMutation</code> — always hits the network, no caching.
        On success, <code>cache.invalidateByEndpoint("GET /posts")</code> busts
        the list so it refetches on next view.
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Title
          <input name="title" placeholder="My new post" required />
        </label>
        <label>
          Body
          <textarea name="body" rows={3} placeholder="Post body…" required />
        </label>
        <div className="form-footer">
          <button className="btn" type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : "Create Post"}
          </button>
          {(isSuccess || isError) && (
            <button className="btn btn--ghost" type="button" onClick={reset}>
              Reset
            </button>
          )}
        </div>
      </form>

      {isError && (
        <div className="callout callout--error">
          Network error: {error?.error.message}
        </div>
      )}
      {isSuccess && result?.status === 201 && (
        <div className="callout callout--success">
          <strong>Created!</strong> Returned ID:{" "}
          <code>{result.data.id}</code>
          <br />
          <span className="muted">
            (JSONPlaceholder simulates writes — it always returns id 101.)
          </span>
          <pre>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}

// ─── Cache Tab ────────────────────────────────────────────────────────────────

function CacheTab() {
  const [userId, setUserId] = useState(1);

  const { result, isLoading, isFetching, refetch, invalidate, invalidateEndpoint } =
    useTypedFetch(`${BASE}/users/${userId}`, undefined, {
      endpointKey: "GET /users/:id",
      keepPreviousData: true, // show previous user while next loads
    });

  return (
    <div className="panel-grid">
      <section className="panel">
        <h2>User Fetch</h2>
        <p className="muted">
          Cache: <code>staleTime 30 s</code> · <code>gcTime 5 min</code>
          <br />
          Switch user IDs to see <code>keepPreviousData</code> — the previous
          user stays visible while the next one loads.
        </p>

        <div className="id-switcher">
          {[1, 2, 3, 4, 5].map((id) => (
            <button
              key={id}
              type="button"
              className={`btn btn--sm ${userId === id ? "" : "btn--ghost"}`}
              onClick={() => setUserId(id)}
            >
              User {id}
            </button>
          ))}
        </div>

        <div className="cache-actions">
          <button type="button" className="btn btn--sm" onClick={refetch}>
            Refetch
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={invalidate}
          >
            Invalidate URL
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={invalidateEndpoint}
          >
            Invalidate Endpoint
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => cache.invalidateAll()}
          >
            Invalidate All
          </button>
        </div>

        <div className="badge-row" style={{ marginTop: "0.6rem" }}>
          {isLoading && <span className="badge badge--orange">loading</span>}
          {isFetching && !isLoading && (
            <span className="badge badge--blue">fetching</span>
          )}
          {!isLoading && !isFetching && (
            <span className="badge badge--green">idle</span>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Result</h2>
        {isLoading && !result && <p className="muted">Loading…</p>}
        {result?.status === 200 && (
          <dl className="user-card">
            <dt>Name</dt>
            <dd>{result.data.name}</dd>
            <dt>Username</dt>
            <dd>@{result.data.username}</dd>
            <dt>Email</dt>
            <dd>{result.data.email}</dd>
            <dt>City</dt>
            <dd>{result.data.address.city}</dd>
            <dt>Company</dt>
            <dd>{result.data.company.name}</dd>
            <dt>Website</dt>
            <dd>{result.data.website}</dd>
          </dl>
        )}
      </section>

      <section className="panel panel--wide">
        <h2>Generic Adapter — server-side observation</h2>
        <p className="muted">
          In a Vite-only app, <code>typedFetch</code> observes responses on the
          client. When you own the server, use an adapter to observe server-side
          — types are generated from the actual API contract, not client traffic.
          All adapters are no-ops in production.
        </p>
        <pre className="code-block">{`// ── Hono — one line covers every route ─────────────────────────────────
import { typedFetchObserver } from "@phumudzo/typed-fetch/adapters/hono";

const app = new Hono();
app.use("*", typedFetchObserver()); // dev-only, no-op in production

app.get("/users/:id", (c) =>
  c.json({ id: c.req.param("id"), name: "Alice" })
);

// ── Next.js App Router — wrap per handler ────────────────────────────────
// app/api/users/[id]/route.ts
import { withTypedFetchObserver } from "@phumudzo/typed-fetch/adapters/next";

export const GET = withTypedFetchObserver(
  "GET /api/users/:id",
  async (req) => {
    const id = new URL(req.url).pathname.split("/").at(-1);
    return Response.json({ id, name: "Alice" });
  },
);

// ── Generic (Express, Fastify, etc.) ────────────────────────────────────
import { observeResponse } from "@phumudzo/typed-fetch/adapters/generic";

app.get("/users/:id", async (req, res) => {
  const data = { id: req.params.id, name: "Alice" };
  const response = Response.json(data);
  await observeResponse("GET /users/:id", response); // dev-only
  res.json(data);
});`}</pre>
      </section>
    </div>
  );
}
