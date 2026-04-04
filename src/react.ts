/**
 * React integration for typed-fetch.
 *
 * Requires React 18+ (uses `useSyncExternalStore`).
 *
 * @example
 * import { createTypedFetchCache } from "@phumudzo/typed-fetch";
 * import { TypedFetchProvider, useTypedFetch } from "@phumudzo/typed-fetch/react";
 *
 * const cache = createTypedFetchCache({ staleTime: 60_000 });
 *
 * function App() {
 *   return (
 *     <TypedFetchProvider cache={cache}>
 *       <UserCard id="1" />
 *     </TypedFetchProvider>
 *   );
 * }
 *
 * function UserCard({ id }: { id: string }) {
 *   const { result, isLoading, isError, error } = useTypedFetch(
 *     `/users/${id}`,
 *     undefined,
 *     { endpointKey: "GET /users/:id" },
 *   );
 *
 *   if (isLoading) return <p>Loading…</p>;
 *   if (isError) return <p>Error: {error?.error.message}</p>;
 *   if (result?.status === 200) return <p>{result.data.name}</p>;
 *   return null;
 * }
 */

import * as React from "react";
import { typedFetch, isNetworkError } from "./tFetch";
import type { TypedFetchResult, TypedFetchNetworkError, TypedFetchOptions, TypedEndpointKey } from "./tFetch";
import type { TypedFetchCache } from "./cache";
import type { TypedFetchConfig, TypedFetchRequestInit } from "./core/types";

// ─── Context ──────────────────────────────────────────────────────────────────

const TypedFetchContext = React.createContext<TypedFetchCache | null>(null);

/**
 * Provides a `TypedFetchCache` to all `useTypedFetch` and `useTypedMutation`
 * hooks in the subtree. Use `React.createElement` syntax to avoid requiring
 * JSX configuration in the host project.
 *
 * @example
 * React.createElement(TypedFetchProvider, { cache }, children)
 * // or in JSX:
 * <TypedFetchProvider cache={cache}>{children}</TypedFetchProvider>
 */
export function TypedFetchProvider({
  cache,
  children,
}: {
  cache: TypedFetchCache;
  children: React.ReactNode;
}): React.ReactElement {
  return React.createElement(TypedFetchContext.Provider, { value: cache }, children);
}

// ─── useTypedFetch ────────────────────────────────────────────────────────────

type UseTypedFetchOptions<K extends TypedEndpointKey, TSelected> = {
  endpointKey: K;
  config?: Partial<TypedFetchConfig>;
  /** Override the cache from context for this specific hook instance. */
  cache?: TypedFetchCache;
  /**
   * When `false`, no fetch is triggered. Useful for dependent queries.
   * @default true
   */
  enabled?: boolean;
  /**
   * Poll interval in ms. The entry is invalidated and re-fetched at this rate.
   * Set `false` or omit to disable polling.
   */
  refetchInterval?: number | false;
  /**
   * While a new `cacheKey` is loading, return the previous key's result
   * instead of `undefined`. Useful for paginated UIs.
   * @default false
   */
  keepPreviousData?: boolean;
  /**
   * Seed the cache on the first render without a network call.
   * Ignored if an entry for this key already exists.
   */
  initialData?: TypedFetchResult<K>;
  /**
   * Transform or select a subset of the cached result.
   * The raw `TypedFetchResult<K>` is always stored; `select` only affects
   * the value returned by the hook.
   */
  select?: (result: TypedFetchResult<K>) => TSelected;
  /** Called after every non-network-error response (including 4xx, 5xx). */
  onSuccess?: (result: TypedFetchResult<K>) => void;
  /**
   * Called when the fetch produces a network error (`result.status === 0`).
   * The full `TypedFetchNetworkError<K>` is provided, preserving the
   * `.error` field (an `Error` instance).
   */
  onError?: (error: TypedFetchNetworkError<K>) => void;
  /** Called after every completed fetch, regardless of outcome. */
  onSettled?: (result: TypedFetchResult<K>) => void;
  /**
   * Re-fetch stale entries when the browser window/tab regains focus.
   * @default true
   */
  refetchOnWindowFocus?: boolean;
  /**
   * Re-fetch when the browser comes back online.
   * @default true
   */
  refetchOnReconnect?: boolean;
};

type UseTypedFetchReturn<K extends TypedEndpointKey, TSelected> = {
  /**
   * The latest result — typed per status code via the discriminated union,
   * or the return value of `select` if provided.
   * `undefined` while the first fetch is in-flight.
   */
  result: TSelected | undefined;
  /** `true` when no result is available yet and the fetch is enabled. */
  isLoading: boolean;
  /** `true` while any fetch is in-flight for this cache key. */
  isFetching: boolean;
  /** `true` when the most recent result has `ok === true` (2xx status). */
  isSuccess: boolean;
  /**
   * `true` when the most recent result is a network error (`status === 0`).
   * Distinct from HTTP errors (4xx/5xx) which have `ok: false` but a real status.
   */
  isError: boolean;
  /**
   * The network error object when `isError` is `true`, otherwise `undefined`.
   * Typed as `TypedFetchNetworkError<K>`:
   * `{ status: 0; ok: false; data: undefined; response: null; error: Error }`
   */
  error: TypedFetchNetworkError<K> | undefined;
  /**
   * Invalidate the exact URL this hook is currently watching and
   * immediately trigger a fresh fetch.
   * Equivalent to `cache.invalidate(url) + fetch`.
   */
  refetch: () => void;
  /**
   * Remove only this hook's exact URL from the cache (no automatic re-fetch).
   * The next render of any consumer watching this URL will trigger a new request.
   * Equivalent to `cache.invalidate(url)`.
   */
  invalidate: () => void;
  /**
   * Remove **all** cached entries for this endpoint key pattern, across every URL
   * that has been observed under it (e.g. `/users/1`, `/users/2`, …).
   * Equivalent to `cache.invalidateByEndpoint(endpointKey)`.
   */
  invalidateEndpoint: () => void;
};

/**
 * Fetches data from a typed endpoint, caches the result, and re-renders
 * the component when the cache entry changes.
 *
 * Must be used inside a `<TypedFetchProvider>` or with `options.cache`.
 *
 * @example
 * const { result, isLoading, isError, error, refetch } = useTypedFetch(
 *   `/users/${id}`,
 *   undefined,
 *   { endpointKey: "GET /users/:id", enabled: !!id },
 * );
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <p>{error?.error.message}</p>;
 * if (result?.status === 200) return <p>{result.data.name}</p>;
 */
export function useTypedFetch<
  K extends TypedEndpointKey = TypedEndpointKey,
  TSelected = TypedFetchResult<K>,
>(
  input: string | URL,
  init: TypedFetchRequestInit | undefined,
  options: UseTypedFetchOptions<K, TSelected>,
): UseTypedFetchReturn<K, TSelected> {
  const ctxCache = React.useContext(TypedFetchContext);
  const cache = options.cache ?? ctxCache;

  if (!cache) {
    throw new Error(
      "[typed-fetch] useTypedFetch requires a TypedFetchCache. " +
        "Wrap your app with <TypedFetchProvider cache={cache}> or pass options.cache.",
    );
  }

  const enabled = options.enabled !== false;
  const method = ((init?.method as string | undefined) ?? "GET").toUpperCase();
  const cacheKey = cache.buildKey(input, method);

  // ── Seed initialData before the first render (in render, not in effect) ──
  const initialSeededRef = React.useRef(false);
  // Track the previous cacheKey so we can reset the seed flag when the key
  // changes (e.g. the consumer navigates to a different URL). We must do this
  // BEFORE the seeding check below so the reset takes effect immediately.
  const prevCacheKeyRef = React.useRef(cacheKey);
  if (prevCacheKeyRef.current !== cacheKey) {
    prevCacheKeyRef.current = cacheKey;
    initialSeededRef.current = false;
  }
  if (
    options.initialData !== undefined &&
    !initialSeededRef.current &&
    !cache.get(cacheKey)
  ) {
    cache.set(cacheKey, options.initialData, options.endpointKey);
    initialSeededRef.current = true;
  }

  // ── useSyncExternalStore — stable snapshot to satisfy React's caching check ─
  type Snapshot = {
    rawResult: TypedFetchResult<K> | undefined;
    isFetching: boolean;
  };
  const snapshotRef = React.useRef<Snapshot>({
    rawResult: undefined,
    isFetching: false,
  });

  const getSnapshot = React.useCallback((): Snapshot => {
    const rawResult = cache.get<TypedFetchResult<K>>(cacheKey)?.result;
    const isFetching = cache.getInFlight(cacheKey) !== undefined;
    const prev = snapshotRef.current;
    if (prev.rawResult === rawResult && prev.isFetching === isFetching) return prev;
    snapshotRef.current = { rawResult, isFetching };
    return snapshotRef.current;
  }, [cache, cacheKey]);

  const state = React.useSyncExternalStore(
    React.useCallback(
      (notify) => cache.subscribe(cacheKey, notify),
      [cache, cacheKey],
    ),
    getSnapshot,
    (): Snapshot => ({ rawResult: undefined, isFetching: false }),
  );

  // ── keepPreviousData ──────────────────────────────────────────────────────
  const previousResultRef = React.useRef<TypedFetchResult<K> | undefined>(undefined);
  if (state.rawResult !== undefined) previousResultRef.current = state.rawResult;

  const rawResult: TypedFetchResult<K> | undefined =
    state.rawResult ??
    (options.keepPreviousData ? previousResultRef.current : undefined);

  // ── Stable callbacks ref — updated each render, never re-triggers effects ─
  const callbacksRef = React.useRef(options);
  callbacksRef.current = options;

  // ── Stable input/init refs — lets effects always read the latest values ───
  // This prevents stale closures when init properties (e.g. auth headers) change
  // without causing a cacheKey change (which would re-run the effects anyway).
  const inputRef = React.useRef(input);
  inputRef.current = input;
  const initRef = React.useRef(init);
  initRef.current = init;

  // ── Initial / key-change fetch ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const currentInit = initRef.current;

    typedFetch<K>(
      inputRef.current,
      currentInit
        ? { ...currentInit, signal: controller.signal }
        : { signal: controller.signal },
      {
        endpointKey: callbacksRef.current.endpointKey,
        config: callbacksRef.current.config,
        cache,
      },
    ).then((result) => {
      if (controller.signal.aborted) return;
      if (isNetworkError(result)) {
        callbacksRef.current.onError?.(result);
      } else {
        callbacksRef.current.onSuccess?.(result);
      }
      callbacksRef.current.onSettled?.(result);
    });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  // ── Polling ───────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const interval = options.refetchInterval;
    if (!interval || !enabled) return;

    const id = setInterval(() => {
      cache.invalidate(inputRef.current, method);
      typedFetch<K>(inputRef.current, initRef.current, {
        endpointKey: callbacksRef.current.endpointKey,
        config: callbacksRef.current.config,
        cache,
      });
    }, interval);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, options.refetchInterval, enabled]);

  // ── Window focus refetch ──────────────────────────────────────────────────
  React.useEffect(() => {
    const refetchOnFocus = options.refetchOnWindowFocus !== false;
    if (!refetchOnFocus || typeof window === "undefined") return;

    const handleFocus = () => {
      if (!enabled) return;
      const e = cache.get(cacheKey);
      if (!e || cache.isStale(e)) {
        typedFetch<K>(inputRef.current, initRef.current, {
          endpointKey: callbacksRef.current.endpointKey,
          config: callbacksRef.current.config,
          cache,
        });
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, options.refetchOnWindowFocus, enabled]);

  // ── Network reconnect refetch ─────────────────────────────────────────────
  React.useEffect(() => {
    const refetchOnReconnect = options.refetchOnReconnect !== false;
    if (!refetchOnReconnect || typeof window === "undefined") return;

    const handleOnline = () => {
      if (!enabled) return;
      typedFetch<K>(inputRef.current, initRef.current, {
        endpointKey: callbacksRef.current.endpointKey,
        config: callbacksRef.current.config,
        cache,
      });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, options.refetchOnReconnect, enabled]);

  // ── invalidate / refetch ──────────────────────────────────────────────────

  /** Remove this exact URL from the cache (no re-fetch). */
  const invalidate = React.useCallback(() => {
    cache.invalidate(input, method);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, cacheKey]);

  /** Remove all URLs for this endpoint key pattern (no re-fetch). */
  const invalidateEndpoint = React.useCallback(() => {
    cache.invalidateByEndpoint(callbacksRef.current.endpointKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, options.endpointKey]);

  /** Invalidate this exact URL and immediately re-fetch. */
  const refetch = React.useCallback(() => {
    cache.invalidate(inputRef.current, method);
    typedFetch<K>(inputRef.current, initRef.current, {
      endpointKey: callbacksRef.current.endpointKey,
      config: callbacksRef.current.config,
      cache,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, cacheKey]);

  // ── Derived values ────────────────────────────────────────────────────────
  const selectedResult =
    rawResult !== undefined && options.select
      ? options.select(rawResult)
      : (rawResult as unknown as TSelected | undefined);

  const networkError =
    rawResult !== undefined && isNetworkError(rawResult) ? rawResult : undefined;

  return {
    result: selectedResult,
    isLoading: rawResult === undefined && enabled,
    isFetching: state.isFetching,
    isSuccess: rawResult !== undefined && networkError === undefined && rawResult.ok === true,
    isError: networkError !== undefined,
    error: networkError,
    refetch,
    invalidate,
    invalidateEndpoint,
  };
}

// ─── useTypedMutation ─────────────────────────────────────────────────────────

type UseTypedMutationOptions<K extends TypedEndpointKey> = {
  endpointKey: K;
  config?: Partial<TypedFetchConfig>;
  /** Called after every non-network-error response (including 4xx, 5xx). */
  onSuccess?: (result: TypedFetchResult<K>) => void;
  /**
   * Called when the mutation produces a network error (`status === 0`).
   * Receives the full `TypedFetchNetworkError<K>` with the `.error: Error` field.
   */
  onError?: (error: TypedFetchNetworkError<K>) => void;
  /** Called after every completed mutation, regardless of outcome. */
  onSettled?: (result: TypedFetchResult<K>) => void;
};

type UseTypedMutationReturn<K extends TypedEndpointKey> = {
  /** Fire the mutation without awaiting the result. */
  mutate: (input: string | URL, init?: TypedFetchRequestInit) => void;
  /** Fire the mutation and return a promise resolving to the full result. */
  mutateAsync: (
    input: string | URL,
    init?: TypedFetchRequestInit,
  ) => Promise<TypedFetchResult<K>>;
  /** The most recent result, or `undefined` before the first mutation or after `reset`. */
  result: TypedFetchResult<K> | undefined;
  /** `true` while a mutation is in-flight. */
  isLoading: boolean;
  /** `true` when the latest result has `ok === true` (2xx status). */
  isSuccess: boolean;
  /**
   * `true` when the latest result is a network error (`status === 0`).
   * Distinct from HTTP errors (4xx/5xx).
   */
  isError: boolean;
  /**
   * The network error when `isError` is `true`, otherwise `undefined`.
   * `{ status: 0; ok: false; data: undefined; response: null; error: Error }`
   */
  error: TypedFetchNetworkError<K> | undefined;
  /** Reset `result`, `isLoading`, `isSuccess`, `isError`, and `error` to their initial state. */
  reset: () => void;
};

/**
 * Manages a single mutation (POST, PUT, PATCH, DELETE) with loading and error state.
 *
 * Unlike `useTypedFetch`, mutations always hit the network — no caching.
 * Use `onSuccess` to invalidate related cache entries after a successful write.
 *
 * @example
 * const cache = createTypedFetchCache();
 *
 * const { mutate, isLoading, isError, error } = useTypedMutation({
 *   endpointKey: "POST /users",
 *   onSuccess: () => cache.invalidateByEndpoint("GET /users"),
 *   onError: (err) => console.error(err.error.message),
 * });
 *
 * mutate("/users", {
 *   method: "POST",
 *   body: JSON.stringify({ name: "Alice" }),
 *   headers: { "Content-Type": "application/json" },
 * });
 */
export function useTypedMutation<K extends TypedEndpointKey = TypedEndpointKey>(
  options: UseTypedMutationOptions<K>,
): UseTypedMutationReturn<K> {
  type State = {
    result: TypedFetchResult<K> | undefined;
    isLoading: boolean;
  };

  const [state, setState] = React.useState<State>({
    result: undefined,
    isLoading: false,
  });

  // Stable ref so callbacks can be updated each render without resetting state.
  const callbacksRef = React.useRef(options);
  callbacksRef.current = options;

  const mutateAsync = React.useCallback(
    async (
      input: string | URL,
      init?: TypedFetchRequestInit,
    ): Promise<TypedFetchResult<K>> => {
      setState({ result: undefined, isLoading: true });

      // Mutations always bypass the cache — they must hit the network.
      const result = await typedFetch<K>(input, init, {
        endpointKey: callbacksRef.current.endpointKey,
        config: callbacksRef.current.config,
      });

      setState({ result, isLoading: false });

      if (isNetworkError(result)) {
        callbacksRef.current.onError?.(result);
      } else {
        callbacksRef.current.onSuccess?.(result);
      }
      callbacksRef.current.onSettled?.(result);

      return result;
    },
    [],
  );

  const mutate = React.useCallback(
    (input: string | URL, init?: TypedFetchRequestInit): void => {
      // Errors are captured in result — never thrown to the caller.
      mutateAsync(input, init).catch(() => undefined);
    },
    [mutateAsync],
  );

  const reset = React.useCallback(() => {
    setState({ result: undefined, isLoading: false });
  }, []);

  const { result, isLoading } = state;
  const mutationNetworkError =
    result !== undefined && isNetworkError(result) ? result : undefined;

  return {
    mutate,
    mutateAsync,
    result,
    isLoading,
    isSuccess: result !== undefined && mutationNetworkError === undefined && result.ok === true,
    isError: mutationNetworkError !== undefined,
    error: mutationNetworkError,
    reset,
  };
}
