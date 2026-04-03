import { queueRegistryObservation } from "./core/file-observer";
import { loadConfig } from "./core/config";
import { shouldTrackEndpoint } from "./core/filter";
import { normalizeEndpointKey } from "./core/normalize";
import { inferShape } from "./core/shape";
import type {
  ShapeNode,
  TypedFetchConfig,
  TypedFetchRequestInit,
  TypedFetchSuccessStatuses,
} from "./core/types";

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
  return Boolean(contentType && contentType.toLowerCase().includes("application/json"));
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
    ok: ToNumericStatus<S & StatusLike> extends TypedFetchSuccessStatuses ? true : false;
    data: TypedFetchGeneratedResponses[K][S];
    response: Response;
  };
}[keyof TypedFetchGeneratedResponses[K]];

/** Returned when the network request itself fails (DNS, timeout, CORS, etc). */
export type TypedFetchNetworkError<K extends string = string> = {
  endpoint: K;
  /** Always 0 for network errors — no HTTP response was received. */
  status: 0;
  ok: false;
  data: undefined;
  response: null;
  error: Error;
};

export type TypedFetchResult<K extends string = string> =
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

type TypedFetchOptions<K extends string> = {
  endpointKey: K;
  config?: Partial<TypedFetchConfig>;
  configPath?: string;
};

export async function typedFetch<K extends string = string>(
  input: RequestInfo | URL,
  init: TypedFetchRequestInit | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>> {
  const config = loadConfig(options?.config, { configPath: options?.configPath });

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
      error: fetchError instanceof Error ? fetchError : new Error(String(fetchError)),
    } as TypedFetchNetworkError<K> as TypedFetchResult<K>;
  }

  const endpointKey = options.endpointKey;
  const method = init?.method ?? "GET";

  if (!endpointKey || typeof endpointKey !== "string") {
    const inferred = normalizeEndpointKey({
      input,
      method,
      dynamicSegmentPatterns: config.dynamicSegmentPatterns,
    });
    throw new Error(
      `typedFetch requires an explicit endpointKey. Suggested key: "${inferred}"`,
    );
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
    }
  } else {
    shape = { kind: "unknown" };
  }

  try {
    const pathname = parsePathname(input);
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
 * Compatibility export. Existing code importing `tFetch` now receives
 * the typed status-aware helper result model.
 */
export function tFetch<K extends string = string>(
  input: RequestInfo | URL,
  init: TypedFetchRequestInit | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>> {
  return typedFetch(input, init, options);
}

export default typedFetch;
