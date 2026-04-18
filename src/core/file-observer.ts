import { observeManyToRegistryPath } from "./registry";
import type { ShapeNode } from "./types";

type QueuedObservation = {
  endpointKey: string;
  status: number;
  shape: ShapeNode;
  observedAt?: Date;
  rawPath?: string;
};

type QueueState = {
  observations: QueuedObservation[];
  timer: NodeJS.Timeout | null;
};

const queueByRegistryPath = new Map<string, QueueState>();
const DEFAULT_FLUSH_DELAY_MS = 40;
const FORCE_FLUSH_COUNT = 20;
let hasRegisteredExitHook = false;

function flush(registryPath: string): void {
  const state = queueByRegistryPath.get(registryPath);
  if (!state || state.observations.length === 0) {
    return;
  }

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  const batch = state.observations.splice(0, state.observations.length);
  try {
    observeManyToRegistryPath({
      registryPath,
      observations: batch,
    });
  } catch {
    // Best effort: observation recording must never break request flow.
  }

  // Remove the map entry once fully drained to avoid unbounded growth in
  // long-running processes that observe many different registry paths.
  if (state.observations.length === 0 && state.timer === null) {
    queueByRegistryPath.delete(registryPath);
  }
}

export function queueRegistryObservation(args: {
  registryPath: string;
  observation: QueuedObservation;
  flushDelayMs?: number;
}): void {
  if (!hasRegisteredExitHook) {
    hasRegisteredExitHook = true;
    process.once("beforeExit", flushAllRegistryObservationQueues);
  }

  const state = queueByRegistryPath.get(args.registryPath) ?? {
    observations: [],
    timer: null,
  };
  if (!queueByRegistryPath.has(args.registryPath)) {
    queueByRegistryPath.set(args.registryPath, state);
  }

  state.observations.push(args.observation);

  if (state.observations.length >= FORCE_FLUSH_COUNT) {
    flush(args.registryPath);
    return;
  }

  if (!state.timer) {
    const delay = args.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
    state.timer = setTimeout(() => {
      flush(args.registryPath);
    }, delay);
  }
}

/**
 * Immediately flushes all pending observations to their registry files.
 *
 * Observations are normally batched and written asynchronously (40 ms delay).
 * Call this before {@link generateTypes} in scripts and tests to ensure the
 * registry is fully up-to-date before generating types.
 *
 * @example
 * await typedFetch(url, undefined, { endpointKey: "GET /users/:id" });
 * flushObservations(); // exported as flushObservations from the main package
 * generateTypes();
 */
export function flushAllRegistryObservationQueues(): void {
  for (const registryPath of queueByRegistryPath.keys()) {
    flush(registryPath);
  }
}
