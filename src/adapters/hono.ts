import type { TypedFetchConfig } from "../core/types";
import { observeResponse } from "./generic";

/**
 * Minimal subset of Hono's Context used by this middleware.
 * Structurally compatible with Hono's actual Context type — no hono import needed.
 */
interface HonoContext {
  req: {
    /** HTTP method, e.g. "GET" */
    method: string;
    /**
     * Matched route pattern, e.g. "/users/:id".
     * Available in Hono v3+.
     */
    routePath: string;
  };
  /** The outgoing Response object (set after next() resolves). */
  res: Response;
}

type Next = () => Promise<void>;
type MiddlewareHandler = (c: HonoContext, next: Next) => Promise<void>;

/**
 * Hono middleware that observes all JSON responses and writes their shapes
 * to the typed-fetch registry. Register once with `app.use("*", ...)` to
 * cover every route automatically.
 *
 * Requires Hono v3+. Non-JSON responses are silently skipped. Observation
 * failures never affect the response.
 *
 * @param config - Optional typed-fetch config overrides (e.g. `registryPath`).
 *
 * @example
 * import { Hono } from "hono";
 * import { typedFetchObserver } from "@phumudzo/typed-fetch/adapters/hono";
 *
 * const app = new Hono();
 * app.use("*", typedFetchObserver());
 *
 * app.get("/users/:id", (c) => c.json({ id: 1, name: "Alice" }));
 */
export function typedFetchObserver(
  config?: Partial<TypedFetchConfig>,
): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const method = c.req.method.toUpperCase();
    const routePath = c.req.routePath; // pattern like /users/:id
    const endpointKey = `${method} ${routePath}`;
    await observeResponse(endpointKey, c.res, config);
  };
}
