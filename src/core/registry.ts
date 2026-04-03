import { dirname } from "path";
import { mergeShapes, serializeShape } from "./shape";
import type { Registry, ShapeNode } from "./types";

export const REGISTRY_VERSION = 2;

type RegistryObservation = {
  endpointKey: string;
  status: number;
  shape: ShapeNode;
  observedAt?: Date;
  rawPath?: string;
};

export function createEmptyRegistry(): Registry {
  return {
    version: REGISTRY_VERSION,
    endpoints: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(input: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value.map((item) => {
        const normalized = normalize(item);
        return normalized === undefined ? null : normalized;
      });
    }

    if (value && typeof value === "object") {
      const sorted: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>).sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        const normalized = normalize(item);
        if (normalized !== undefined) {
          sorted[key] = normalized;
        }
      }
      return sorted;
    }

    return value;
  };

  return JSON.stringify(normalize(input));
}

function ensureDir(path: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

export function loadRegistry(path: string): Registry {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  if (!fs.existsSync(path)) {
    return createEmptyRegistry();
  }

  try {
    const raw = fs.readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== REGISTRY_VERSION || !isRecord(parsed.endpoints)) {
      throw new Error("Invalid registry structure");
    }
    return parsed as Registry;
  } catch {
    process.emitWarning(`typed-fetch: corrupt or outdated registry at "${path}", resetting.`);
    fs.rmSync(path, { force: true });
    return createEmptyRegistry();
  }
}

export function saveRegistry(path: string, registry: Registry): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  ensureDir(dirname(path));

  const serialized = `${stableStringify(registry)}\n`;
  const tmpPath = `${path}.tmp`;
  fs.writeFileSync(tmpPath, serialized, "utf8");
  fs.renameSync(tmpPath, path);
}

export function observeShape(args: {
  registry: Registry;
  endpointKey: string;
  status: number;
  shape: ShapeNode;
  observedAt?: Date;
  rawPath?: string;
}): Registry {
  const registry = args.registry;
  const endpoint = registry.endpoints[args.endpointKey] ?? {
    responses: {},
    meta: {
      seenCount: 0,
      lastSeenAt: new Date(0).toISOString(),
      observedPaths: [],
    },
  };

  const statusKey = String(args.status);
  const nextShape = serializeShape(args.shape);
  const existing = endpoint.responses[statusKey];
  endpoint.responses[statusKey] = existing
    ? serializeShape(mergeShapes(existing, nextShape))
    : nextShape;

  endpoint.meta = {
    seenCount: endpoint.meta.seenCount + 1,
    lastSeenAt: (args.observedAt ?? new Date()).toISOString(),
    observedPaths: (() => {
      const current = Array.isArray(endpoint.meta.observedPaths)
        ? endpoint.meta.observedPaths
        : [];
      if (!args.rawPath) {
        return current;
      }
      if (current.includes(args.rawPath)) {
        return current;
      }
      return [...current, args.rawPath].slice(0, 20);
    })(),
  };

  registry.endpoints[args.endpointKey] = endpoint;
  return registry;
}

function sleepMs(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy wait for short lock-retry windows.
  }
}

function withRegistryLock<T>(registryPath: string, fn: () => T): T {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  const lockPath = `${registryPath}.lock`;
  const start = Date.now();
  const timeoutMs = 1500;
  let lockFd: number | null = null;

  while (Date.now() - start < timeoutMs) {
    try {
      ensureDir(dirname(registryPath));
      lockFd = fs.openSync(lockPath, "wx");
      break;
    } catch {
      sleepMs(20);
    }
  }

  if (lockFd === null) {
    throw new Error(`Could not acquire registry lock for ${registryPath}`);
  }

  try {
    return fn();
  } finally {
    try {
      fs.closeSync(lockFd);
    } catch {
      // best effort
    }
    fs.rmSync(lockPath, { force: true });
  }
}

export function observeShapeToRegistryPath(args: RegistryObservation & { registryPath: string }): void {
  withRegistryLock(args.registryPath, () => {
    const registry = loadRegistry(args.registryPath);
    observeShape({
      registry,
      endpointKey: args.endpointKey,
      status: args.status,
      shape: args.shape,
      observedAt: args.observedAt,
      rawPath: args.rawPath,
    });
    saveRegistry(args.registryPath, registry);
  });
}

export function observeManyToRegistryPath(args: {
  registryPath: string;
  observations: RegistryObservation[];
}): void {
  if (args.observations.length === 0) {
    return;
  }

  withRegistryLock(args.registryPath, () => {
    const registry = loadRegistry(args.registryPath);
    for (const observation of args.observations) {
      observeShape({
        registry,
        endpointKey: observation.endpointKey,
        status: observation.status,
        shape: observation.shape,
        observedAt: observation.observedAt,
        rawPath: observation.rawPath,
      });
    }
    saveRegistry(args.registryPath, registry);
  });
}

export function mergeRegistryInto(target: Registry, incoming: Registry): Registry {
  for (const [endpointKey, endpoint] of Object.entries(incoming.endpoints)) {
    for (const [statusKey, shape] of Object.entries(endpoint.responses)) {
      observeShape({
        registry: target,
        endpointKey,
        status: Number(statusKey),
        shape,
      });
    }
  }
  return target;
}

export function mergeRegistryIntoPath(path: string, incoming: Registry): void {
  withRegistryLock(path, () => {
    const registry = loadRegistry(path);
    mergeRegistryInto(registry, incoming);
    saveRegistry(path, registry);
  });
}

export function clearRegistry(path: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  if (fs.existsSync(path)) {
    fs.rmSync(path, { force: true });
  }
}
