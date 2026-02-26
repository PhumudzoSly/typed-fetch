import { queueRegistryObservation } from "./core/file-observer";
import { loadConfig } from "./core/config";
import { hasLocalStorage, loadBrowserRegistry, saveBrowserRegistry } from "./core/browser-registry";
import { shouldTrackEndpoint } from "./core/filter";
import { normalizeEndpointKey } from "./core/normalize";
import { observeShape } from "./core/registry";
import { inferShape } from "./core/shape";
import { pushObservation } from "./core/sync";
import type {
  ObservationPayload,
  ShapeNode,
  TypedFetchConfig,
  TypedFetchRequestInit,
  TypedFetchSuccessStatuses,
} from "./core/types";

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type JsonBodyPrimitive = string | number | boolean | null;
export type JsonBodyValue =
  | JsonBodyPrimitive
  | JsonBodyValue[]
  | { [key: string]: JsonBodyValue | undefined };

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

function isNodeWritableRuntime(): boolean {
  return isNodeRuntime;
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

/**
 * Manual request-body map keyed by endpointKey.
 *
 * Users can augment this interface in their own declaration files to enforce
 * request body types per endpoint.
 */
export interface TypedFetchGeneratedRequests {}

type KnownEndpointKey = keyof TypedFetchGeneratedResponses & string;
type KnownRequestEndpointKey = keyof TypedFetchGeneratedRequests & string;
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

export type TypedFetchResult<K extends string = string> = K extends KnownEndpointKey
  ? KnownEndpointResult<K>
  : {
      endpoint: K;
      status: number;
      ok: boolean;
      data: unknown;
      response: Response;
    };

type TypedFetchOptions<K extends string> = {
  endpointKey: K;
  config?: Partial<TypedFetchConfig>;
  configPath?: string;
};

export type TypedFetchBody<K extends string> = K extends KnownRequestEndpointKey
  ? TypedFetchGeneratedRequests[K]
  : never;

export type TypedFetchInit<K extends string = string> = Omit<TypedFetchRequestInit, "body"> & {
  body?: BodyInit | TypedFetchBody<K> | null;
};

function isBodyInitLike(value: unknown): value is BodyInit {
  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
    return true;
  }
  if (typeof FormData !== "undefined" && value instanceof FormData) {
    return true;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true;
  }
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return true;
  }
  if (ArrayBuffer.isView(value)) {
    return true;
  }
  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
    return true;
  }
  return false;
}

function prepareRequestInit<K extends string>(init: TypedFetchInit<K> | undefined): RequestInit | undefined {
  if (!init || init.body === undefined || init.body === null) {
    return init;
  }

  if (isBodyInitLike(init.body)) {
    return init;
  }

  const headers = new Headers(init.headers ?? undefined);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return {
    ...init,
    headers,
    body: JSON.stringify(init.body),
  };
}

export function typedJsonBody<T extends JsonBodyValue>(
  value: T,
  options: { headers?: HeadersInit } = {}
): Pick<RequestInit, "body" | "headers"> {
  const headers = new Headers(options.headers ?? undefined);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return {
    body: new Blob([JSON.stringify(value)], {
      type: headers.get("content-type") ?? "application/json",
    }),
    headers,
  };
}

export async function typedFetch<K extends KnownRequestEndpointKey>(
  input: RequestInfo | URL,
  init: TypedFetchInit<K> | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>>;

export async function typedFetch<K extends string = string>(
  input: RequestInfo | URL,
  init: TypedFetchRequestInit | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>>;

export async function typedFetch<K extends string = string>(
  input: RequestInfo | URL,
  init: TypedFetchInit<K> | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>> {
  const preparedInit = prepareRequestInit(init);
  const response = await fetchFunction(input, preparedInit);
  const config = loadConfig(options?.config, { configPath: options?.configPath });
  const method = preparedInit?.method ?? "GET";
  const endpointKey = options.endpointKey;

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
      const observation: ObservationPayload = {
        endpointKey,
        status: response.status,
        shape,
        observedAt: new Date().toISOString(),
        source: isNodeRuntime ? "node" : "browser",
      };
      const mode = config.observerMode;

      if (mode === "none") {
        // Explicitly disabled.
      } else if (mode === "file" || (mode === "auto" && isNodeWritableRuntime())) {
        queueRegistryObservation({
          registryPath: config.registryPath,
          observation: {
            endpointKey: observation.endpointKey,
            status: observation.status,
            shape: observation.shape,
            observedAt: new Date(observation.observedAt),
            rawPath: config.strictPrivacyMode ? undefined : pathname,
          },
        });
      } else if (
        mode === "localStorage" ||
        (mode === "auto" && hasLocalStorage())
      ) {
        const registry = loadBrowserRegistry(config.browserStorageKey);
        observeShape({
          registry,
          endpointKey: observation.endpointKey,
          status: observation.status,
          shape: observation.shape,
          rawPath: config.strictPrivacyMode ? undefined : pathname,
        });
        saveBrowserRegistry(config.browserStorageKey, registry);
      }

      if (config.syncUrl) {
        void pushObservation({
          syncUrl: config.syncUrl,
          timeoutMs: config.syncTimeoutMs,
          observation,
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
export function tFetch<K extends KnownRequestEndpointKey>(
  input: RequestInfo | URL,
  init: TypedFetchInit<K> | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>>;

export function tFetch<K extends string = string>(
  input: RequestInfo | URL,
  init: TypedFetchRequestInit | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>>;

export function tFetch<K extends string = string>(
  input: RequestInfo | URL,
  init: TypedFetchInit<K> | undefined,
  options: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>> {
  return typedFetch(input, init, options);
}

export default typedFetch;
