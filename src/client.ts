import type { TypedFetchCache } from "./cache";
import type { TypedFetchConfig } from "./core/types";
import type { TypedEndpointKey, TypedFetchResult } from "./tFetch";
import { typedFetch } from "./tFetch";

type TypedFetchRequestInit = RequestInit;

type ClientOptions = {
  /** Base URL prepended to every path passed to `client.fetch`. */
  baseUrl: string;
  /** Optional config overrides applied to every request made by this client. */
  config?: Partial<TypedFetchConfig>;
  /** Optional path to a typed-fetch config file. */
  configPath?: string;
  /**
   * Optional cache applied to every request made by this client.
   * Per-call `options.cache` takes precedence if both are provided.
   */
  cache?: TypedFetchCache;
};

type ClientFetchOptions<K extends TypedEndpointKey> = {
  endpointKey: K;
  config?: Partial<TypedFetchConfig>;
  configPath?: string;
  /** Per-call cache override. Falls back to the client-level cache when omitted. */
  cache?: TypedFetchCache;
};

type TypedFetchClient = {
  /**
   * Fetch a path relative to the client's `baseUrl`.
   *
   * @param path    - URL path (e.g. `"/users/123"`). Prepended with `baseUrl`.
   * @param init    - Optional fetch init options (method, headers, body, etc).
   * @param options - typed-fetch options. `endpointKey` is required.
   *
   * @example
   * const result = await client.fetch("/users/123", undefined, {
   *   endpointKey: "GET /users/:id",
   * });
   */
  fetch<K extends TypedEndpointKey = TypedEndpointKey>(
    path: string,
    init: TypedFetchRequestInit | undefined,
    options: ClientFetchOptions<K>,
  ): Promise<TypedFetchResult<K>>;
};

/**
 * Creates a typed-fetch client with a `baseUrl` pre-applied so callers
 * don't have to repeat it on every request.
 *
 * @param options - Client options. `baseUrl` is required.
 *
 * @example
 * const cache = createTypedFetchCache({ staleTime: 60_000 });
 * const client = createTypedFetchClient({
 *   baseUrl: "https://api.example.com",
 *   cache,
 * });
 *
 * const result = await client.fetch("/users/123", undefined, {
 *   endpointKey: "GET /users/:id",
 * });
 */
export function createTypedFetchClient(
  options: ClientOptions,
): TypedFetchClient {
  const {
    baseUrl,
    config: clientConfig,
    configPath: clientConfigPath,
    cache: clientCache,
  } = options;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return {
    fetch<K extends TypedEndpointKey = TypedEndpointKey>(
      path: string,
      init: TypedFetchRequestInit | undefined,
      fetchOptions: ClientFetchOptions<K>,
    ): Promise<TypedFetchResult<K>> {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${normalizedBase}${normalizedPath}`;

      const mergedConfig: Partial<TypedFetchConfig> = {
        ...clientConfig,
        ...fetchOptions.config,
      };

      return typedFetch<K>(url, init, {
        endpointKey: fetchOptions.endpointKey,
        config: Object.keys(mergedConfig).length > 0 ? mergedConfig : undefined,
        configPath: fetchOptions.configPath ?? clientConfigPath,
        cache: fetchOptions.cache ?? clientCache,
      });
    },
  };
}
