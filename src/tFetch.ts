import { queueRegistryObservation } from "./core/file-observer";
import { postObservationToServer } from "./core/http-observer";
import { loadConfig } from "./core/config";
import { shouldTrackEndpoint } from "./core/filter";
import { normalizeEndpointKey } from "./core/normalize";
import { inferShape } from "./core/shape";
import type {
  EndpointKey,
  ShapeNode,
  TypedFetchConfig,
  TypedFetchRequestInit,
  TypedFetchSuccessStatuses,
} from "./core/types";

type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const isNodeRuntime =
  typeof process !== "undefined" &&
  Boolean(process.versions) &&
  Boolean(process.versions.node);

const fetchFunction: FetchFunction = (() => {
  if (typeof fetch === "function") {
    return fetch.bind(globalThis) as FetchFunction;
  }
  throw new Error("No fetch implementation available in this runtime.");
})();

function parsePathname(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return new URL(input, "http://typed-fetch.local").pathname;
  }
  if (input instanceof URL) {
    return input.pathname;
  }
  const request = input as Request;
  return new URL(request.url, "http://typed-fetch.local").pathname;
}

function isJsonContentType(contentType: string | null): boolean {
  return Boolean(
    contentType && contentType.toLowerCase().includes("application/json"),
  );
}

function emitDevWarning(message: string, code = "TYPED_FETCH_WARNING"): void {
  if (isNodeRuntime && typeof process.emitWarning === "function") {
    process.emitWarning(message, { code });
  } else if (typeof console !== "undefined") {
    console.warn(`[typed-fetch] ${message}`);
  }
}

function isValidEndpointKeyFormat(endpointKey: string): boolean {
  const spaceIdx = endpointKey.indexOf(" ");
  if (spaceIdx <= 0 || spaceIdx !== endpointKey.lastIndexOf(" ")) {
    return false;
  }

  const method = endpointKey.slice(0, spaceIdx);
  const path = endpointKey.slice(spaceIdx + 1);
  return /^[A-Z]+$/.test(method) && path.startsWith("/") && path.length > 0;
}

function warnIfKeyMismatch(
  endpointKey: string,
  method: string,
  pathname: string,
): void {
  const spaceIdx = endpointKey.indexOf(" ");
  if (spaceIdx === -1) {
    return; // Key doesn't follow "METHOD /path" format — skip.
  }

  const keyMethod = endpointKey.slice(0, spaceIdx).toUpperCase();
  const keyPath = endpointKey.slice(spaceIdx + 1);

  if (keyMethod !== method.toUpperCase()) {
    emitDevWarning(
      `endpointKey method "${keyMethod}" does not match request method "${method.toUpperCase()}" (key: "${endpointKey}")`,
      "TYPED_FETCH_KEY_MISMATCH",
    );
    return;
  }

  const keySegments = keyPath.split("/").filter(Boolean);
  const actualSegments = pathname.split("/").filter(Boolean);

  if (keySegments.length !== actualSegments.length) {
    emitDevWarning(
      `endpointKey "${endpointKey}" has ${keySegments.length} path segment(s) but actual path "${pathname}" has ${actualSegments.length}`,
      "TYPED_FETCH_KEY_MISMATCH",
    );
    return;
  }

  for (let i = 0; i < keySegments.length; i++) {
    const keySeg = keySegments[i];
    if (!keySeg.startsWith(":") && keySeg !== actualSegments[i]) {
      emitDevWarning(
        `endpointKey "${endpointKey}" static segment "${keySeg}" does not match actual path segment "${actualSegments[i]}" (position ${i})`,
        "TYPED_FETCH_KEY_MISMATCH",
      );
      return;
    }
  }
}

function isOkStatus(status: number): status is TypedFetchSuccessStatuses {
  return (
    status === 200 ||
    status === 201 ||
    status === 202 ||
    status === 203 ||
    status === 204 ||
    status === 205 ||
    status === 206 ||
    status === 207 ||
    status === 208 ||
    status === 226
  );
}

export interface TypedFetchGeneratedResponses {}

type KnownEndpointKey = keyof TypedFetchGeneratedResponses & string;
type StatusLike = number | `${number}`;

type ToNumericStatus<S extends StatusLike> = S extends number
  ? S
  : S extends `${infer N extends number}`
    ? N
    : number;

type KnownEndpointResult<K extends KnownEndpointKey> = {
  [S in keyof TypedFetchGeneratedResponses[K]]: {
    endpoint: K;
    status: ToNumericStatus<S & StatusLike>;
    ok: ToNumericStatus<S & StatusLike> extends TypedFetchSuccessStatuses
      ? true
      : false;
    data: TypedFetchGeneratedResponses[K][S];
    response: Response;
    error?: undefined;
  };
}[keyof TypedFetchGeneratedResponses[K]];

/**
 * Returned when the network request itself fails before an HTTP response
 * is received — e.g. DNS failure, connection refused, timeout, CORS error.
 *
 * Discriminate from a normal result by checking `result.error` or
 * `result.status === 0`.
 */
export type TypedFetchNetworkError<K extends EndpointKey = EndpointKey> = {
  endpoint: K;
  /** Always 0 for network errors — no HTTP response was received. */
  status: 0;
  ok: false;
  data: undefined;
  response: null;
  error: Error;
};

export type TypedFetchResult<K extends EndpointKey = EndpointKey> =
  | TypedFetchNetworkError<K>
  | (K extends KnownEndpointKey
      ? KnownEndpointResult<K>
      : {
          endpoint: K;
          status: number;
          ok: boolean;
          data: unknown;
          response: Response;
          error?: undefined;
        });

type TypedFetchOptions<K extends EndpointKey> = {
  endpointKey: K;
  config?: Partial<TypedFetchConfig>;
  configPath?: string;
};

/**
 * A privacy-first, status-aware typed fetch wrapper.
 *
 * Wraps the native `fetch` API and returns a discriminated result object
 * instead of throwing. JSON response shapes are automatically observed and
 * recorded to a registry file, from which TypeScript types can be generated
 * with `generateTypes()` or `typed-fetch generate`.
 *
 * @param input   - The URL or Request to fetch (same as `fetch`'s first arg).
 * @param init    - Optional fetch init options (method, headers, body, etc).
 * @param options - typed-fetch options. `endpointKey` is required and should
 *                  match the pattern `"METHOD /path/:param"`.
 *
 * @returns A {@link TypedFetchResult} containing `status`, `ok`, `data`, and
 *          `response`. On network failure, returns a {@link TypedFetchNetworkError}
 *          with `status: 0` and an `error` field — never throws.
 *
 * @example
 * const result = await typedFetch("/api/users/1", undefined, {
 *   endpointKey: "GET /api/users/:id",
 * });
 * if (result.error) {
 *   console.error("Network failure:", result.error.message);
 * } else if (result.ok) {
 *   console.log(result.data); // typed as the 200 response shape
 * }
 */
export async function typedFetch<K extends EndpointKey = EndpointKey>(
  input: RequestInfo | URL,
  init: TypedFetchRequestInit | undefined,
  options: TypedFetchOptions<K>,
): Promise<TypedFetchResult<K>> {
  const config = loadConfig(options?.config, {
    configPath: options?.configPath,
  });
  const endpointKey = options.endpointKey;
  const method = init?.method ?? "GET";

  if (
    !endpointKey ||
    typeof endpointKey !== "string" ||
    !isValidEndpointKeyFormat(endpointKey)
  ) {
    const inferred = normalizeEndpointKey({
      input,
      method,
      dynamicSegmentPatterns: config.dynamicSegmentPatterns,
    });
    throw new Error(
      `typedFetch requires an endpointKey matching \"METHOD /path\" (e.g. \"GET /users/:id\"). Suggested key: \"${inferred}\"`,
    );
  }

  let response: Response;
  try {
    response = await fetchFunction(input, init);
  } catch (fetchError) {
    return {
      endpoint: options.endpointKey,
      status: 0,
      ok: false,
      data: undefined,
      response: null,
      error:
        fetchError instanceof Error
          ? fetchError
          : new Error(String(fetchError)),
    } as TypedFetchNetworkError<K> as TypedFetchResult<K>;
  }

  let data: unknown = undefined;
  let shape: ShapeNode = { kind: "unknown" };
  const contentType = response.headers.get("content-type");
  const jsonCandidate = isJsonContentType(contentType);

  if (jsonCandidate) {
    try {
      data = await response.clone().json();
      shape = inferShape(data, config);
    } catch {
      data = undefined;
      shape = { kind: "unknown" };
      emitDevWarning(
        `Response for "${endpointKey}" has content-type application/json but body failed to parse. Shape recorded as unknown.`,
        "TYPED_FETCH_JSON_PARSE_FAILED",
      );
    }
  } else {
    shape = { kind: "unknown" };
  }

  try {
    const pathname = parsePathname(input);
    warnIfKeyMismatch(endpointKey, method, pathname);
    if (shouldTrackEndpoint(pathname, config.include, config.exclude)) {
      const mode = config.observerMode;
      if (mode === "file" || (mode === "auto" && isNodeRuntime)) {
        queueRegistryObservation({
          registryPath: config.registryPath,
          observation: {
            endpointKey,
            status: response.status,
            shape,
            observedAt: new Date(),
            rawPath: config.strictPrivacyMode ? undefined : pathname,
          },
        });
      } else if (mode === "http" || (mode === "auto" && !isNodeRuntime)) {
        postObservationToServer({
          observerPort: config.observerPort,
          observation: {
            endpointKey,
            status: response.status,
            shape,
            observedAt: new Date().toISOString(),
            rawPath: config.strictPrivacyMode ? undefined : pathname,
          },
        });
      }
    }
  } catch {
    // Observation failures must never block request handling.
  }

  const status = response.status;

  return {
    endpoint: endpointKey,
    status,
    ok: isOkStatus(status),
    data,
    response,
  } as TypedFetchResult<K>;
}

/**
 * Alias for {@link typedFetch}. Provided for shorter import names.
 *
 * @see typedFetch
 */
export function tFetch<K extends EndpointKey = EndpointKey>(
  input: RequestInfo | URL,
  init: TypedFetchRequestInit | undefined,
  options: TypedFetchOptions<K>,
): Promise<TypedFetchResult<K>> {
  return typedFetch(input, init, options);
}

export default typedFetch;
