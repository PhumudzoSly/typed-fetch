import { loadConfig } from "./core/config";
import { hasLocalStorage, loadBrowserRegistry, saveBrowserRegistry } from "./core/browser-registry";
import { shouldTrackEndpoint } from "./core/filter";
import { normalizeEndpointKey } from "./core/normalize";
import { loadRegistry, observeShape, saveRegistry } from "./core/registry";
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

const isNodeRuntime =
  typeof process !== "undefined" &&
  Boolean(process.versions) &&
  Boolean(process.versions.node);

const fetchFunction: FetchFunction = (() => {
  if (typeof fetch === "function") {
    return fetch.bind(globalThis) as FetchFunction;
  }

  if (isNodeRuntime) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeFetch = require("node-fetch") as FetchFunction;
    return nodeFetch;
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
  endpointKey?: K;
  config?: Partial<TypedFetchConfig>;
};

export async function typedFetch<K extends string = string>(
  input: RequestInfo | URL,
  init?: TypedFetchRequestInit,
  options?: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>> {
  const response = await fetchFunction(input, init);
  const config = loadConfig(options?.config);
  const method = init?.method ?? "GET";
  const endpointKey =
    options?.endpointKey ??
    (normalizeEndpointKey({
      input,
      method,
      dynamicSegmentPatterns: config.dynamicSegmentPatterns,
    }) as K);

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
        const registry = loadRegistry(config.registryPath);
        observeShape({
          registry,
          endpointKey: observation.endpointKey,
          status: observation.status,
          shape: observation.shape,
          rawPath: pathname,
        });
        saveRegistry(config.registryPath, registry);
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
          rawPath: pathname,
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
export function tFetch<K extends string = string>(
  input: RequestInfo | URL,
  init?: TypedFetchRequestInit,
  options?: TypedFetchOptions<K>
): Promise<TypedFetchResult<K>> {
  return typedFetch(input, init, options);
}

export default typedFetch;
