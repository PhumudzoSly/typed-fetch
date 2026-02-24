import { dirname } from "path";
import { mergeShapes, serializeShape } from "./shape";
import type { Registry, ShapeNode } from "./types";

export const REGISTRY_VERSION = 1;

export function createEmptyRegistry(): Registry {
  return {
    version: REGISTRY_VERSION,
    endpoints: {},
  };
}

export function coerceRegistry(value: unknown): Registry {
  const parsed = value as Partial<Registry> | null;
  if (!parsed || typeof parsed !== "object") {
    return createEmptyRegistry();
  }
  if (parsed.version !== REGISTRY_VERSION) {
    return createEmptyRegistry();
  }
  if (!parsed.endpoints || typeof parsed.endpoints !== "object") {
    return createEmptyRegistry();
  }
  return parsed as Registry;
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

function backupCorruptRegistry(path: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${path}.invalid-${timestamp}.bak`;
  fs.renameSync(path, backupPath);
}

export function loadRegistry(path: string): Registry {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  if (!fs.existsSync(path)) {
    return createEmptyRegistry();
  }

  try {
    const raw = fs.readFileSync(path, "utf8");
    return coerceRegistry(JSON.parse(raw));
  } catch {
    backupCorruptRegistry(path);
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

export function clearRegistry(path: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  if (fs.existsSync(path)) {
    fs.rmSync(path, { force: true });
  }
}
