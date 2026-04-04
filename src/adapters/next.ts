import type { TypedFetchConfig } from "../core/types";
import { observeResponse } from "./generic";

/**
 * A Next.js App Router route handler that also observes its response.
 * Uses the Web API `Request`/`Response` — compatible with both Node.js
 * and Edge runtimes without importing from `next/server`.
 */
type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response>;

/**
 * Wraps a Next.js App Router route handler to observe its JSON responses
 * and write their shapes to the typed-fetch registry.
 *
 * Provide the `endpointKey` explicitly in `"METHOD /path/:param"` format —
 * the route pattern is in the file-system path, not in the handler itself.
 *
 * @param endpointKey - e.g. `"GET /api/users/:id"`
 * @param handler     - The original route handler function.
 * @param config      - Optional typed-fetch config overrides.
 *
 * @example
 * // app/api/users/[id]/route.ts
 * import { withTypedFetchObserver } from "@phumudzo/typed-fetch/adapters/next";
 *
 * export const GET = withTypedFetchObserver(
 *   "GET /api/users/:id",
 *   async (req) => {
 *     const id = new URL(req.url).pathname.split("/").at(-1);
 *     return Response.json({ id, name: "Alice" });
 *   },
 * );
 */
export function withTypedFetchObserver(
  endpointKey: string,
  handler: RouteHandler,
  config?: Partial<TypedFetchConfig>,
): RouteHandler {
  return async (req, ctx) => {
    const response = await handler(req, ctx);
    await observeResponse(endpointKey, response, config);
    return response;
  };
}
