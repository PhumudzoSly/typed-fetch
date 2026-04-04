export type CacheOptions = {
  /**
   * How long (ms) before a cached entry is considered stale and triggers a
   * network request on the next access.
   * @default 0 — always stale, but concurrent callers still share one in-flight request.
   */
  staleTime?: number;
  /**
   * How long (ms) after an entry is written before it is garbage-collected.
   * The GC timer is reset on each write.
   * @default 300_000 (5 minutes)
   */
  gcTime?: number;
  /**
   * How many times to retry a failed network request (`status === 0`) before
   * giving up and returning the error result. Set `false` to disable retries.
   * @default 3
   */
  retry?: number | false;
  /**
   * Returns the delay in ms before attempt N (0-based).
   * @default exponential back-off capped at 30 s: `min(1000 * 2^n, 30_000)`
   */
  retryDelay?: (attempt: number) => number;
};

type CacheEntry = {
  result: unknown;
  fetchedAt: number;
  endpointKey: string;
};

/**
 * In-memory cache for typed-fetch results.
 *
 * Responsibilities:
 * - Serve fresh entries without hitting the network (`staleTime`).
 * - Deduplicate concurrent requests for the same URL (in-flight map).
 * - Retry network failures with configurable back-off (`retry`, `retryDelay`).
 * - Garbage-collect unused entries (`gcTime`).
 * - Notify React subscribers (`subscribe`) so `useSyncExternalStore` re-renders.
 *
 * @example
 * const cache = createTypedFetchCache({ staleTime: 60_000 });
 * const result = await typedFetch(url, init, { endpointKey: "GET /users/:id", cache });
 * cache.invalidateByEndpoint("GET /users/:id");
 */
export class TypedFetchCache {
  readonly staleTime: number;
  readonly gcTime: number;
  readonly retry: number | false;
  readonly retryDelay: (attempt: number) => number;

  private readonly _entries = new Map<string, CacheEntry>();
  private readonly _inFlight = new Map<string, Promise<unknown>>();
  private readonly _gcTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _listeners = new Map<string, Set<() => void>>();

  constructor(options: CacheOptions = {}) {
    this.staleTime = options.staleTime ?? 0;
    this.gcTime = options.gcTime ?? 5 * 60_000;
    this.retry = options.retry !== undefined ? options.retry : 3;
    this.retryDelay =
      options.retryDelay ?? ((n) => Math.min(1_000 * 2 ** n, 30_000));
  }

  // ─── Key ────────────────────────────────────────────────────────────────────

  /**
   * Builds a stable cache key from a URL and HTTP method.
   * Key format: `"METHOD:url"` using the fully-resolved URL string.
   */
  buildKey(input: RequestInfo | URL, method: string): string {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = (input as Request).url;
    return `${method.toUpperCase()}:${url}`;
  }

  // ─── Entry access ───────────────────────────────────────────────────────────

  get<T>(key: string): { result: T; fetchedAt: number; endpointKey: string } | undefined {
    return this._entries.get(key) as
      | { result: T; fetchedAt: number; endpointKey: string }
      | undefined;
  }

  isStale(entry: { fetchedAt: number }): boolean {
    if (this.staleTime === 0) return true;
    const age = Date.now() - entry.fetchedAt;
    // A negative age means fetchedAt is in the future (clock skew / NTP jump).
    // Treat as stale so we never serve a permanently "fresh" entry.
    return age < 0 || age > this.staleTime;
  }

  set<T>(key: string, result: T, endpointKey: string): void {
    const existing = this._gcTimers.get(key);
    if (existing) clearTimeout(existing);

    this._entries.set(key, { result, fetchedAt: Date.now(), endpointKey });

    const timer = setTimeout(() => {
      this._entries.delete(key);
      this._gcTimers.delete(key);
      this._notify(key);
    }, this.gcTime);

    // Don't prevent Node.js process from exiting while waiting for GC.
    if (typeof (timer as unknown as { unref?: () => void }).unref === "function") {
      (timer as unknown as { unref: () => void }).unref();
    }

    this._gcTimers.set(key, timer);
    this._notify(key);
  }

  // ─── In-flight deduplication ─────────────────────────────────────────────

  getInFlight<T>(key: string): Promise<T> | undefined {
    return this._inFlight.get(key) as Promise<T> | undefined;
  }

  setInFlight<T>(key: string, promise: Promise<T>): void {
    this._inFlight.set(key, promise as Promise<unknown>);
    this._notify(key);
  }

  clearInFlight(key: string): void {
    this._inFlight.delete(key);
    this._notify(key);
  }

  // ─── React subscription ──────────────────────────────────────────────────

  /**
   * Subscribe to cache changes for a specific key.
   * Designed for use with React's `useSyncExternalStore`.
   * Returns an unsubscribe function.
   */
  subscribe(key: string, cb: () => void): () => void {
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key)!.add(cb);
    return () => {
      const set = this._listeners.get(key);
      if (!set) return;
      set.delete(cb);
      if (set.size === 0) this._listeners.delete(key);
    };
  }

  // ─── Invalidation ────────────────────────────────────────────────────────

  /** Remove a specific cache entry by URL and method. */
  invalidate(input: RequestInfo | URL, method = "GET"): void {
    this._evict(this.buildKey(input, method));
  }

  /** Remove all entries whose `endpointKey` matches the given pattern. */
  invalidateByEndpoint(endpointKey: string): void {
    for (const [key, entry] of this._entries) {
      if (entry.endpointKey === endpointKey) this._evict(key);
    }
  }

  /** Clear every entry, all in-flight promises, and all GC timers. */
  invalidateAll(): void {
    this._gcTimers.forEach(clearTimeout);
    const keys = [...this._entries.keys()];
    this._entries.clear();
    this._inFlight.clear();
    this._gcTimers.clear();
    keys.forEach((k) => this._notify(k));
  }

  /** Remove all entries and detach any global event listeners. */
  destroy(): void {
    this.invalidateAll();
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _notify(key: string): void {
    this._listeners.get(key)?.forEach((cb) => cb());
  }

  private _evict(key: string): void {
    this._entries.delete(key);
    this._inFlight.delete(key);
    const timer = this._gcTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this._gcTimers.delete(key);
    }
    this._notify(key);
  }
}

/**
 * Create a new `TypedFetchCache` instance.
 *
 * @example
 * const cache = createTypedFetchCache({ staleTime: 60_000, gcTime: 5 * 60_000 });
 */
export function createTypedFetchCache(options?: CacheOptions): TypedFetchCache {
  return new TypedFetchCache(options);
}
