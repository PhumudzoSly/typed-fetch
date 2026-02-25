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

function parseShapeNode(value: unknown, depth = 0): ShapeNode | null {
  if (!isRecord(value)) {
    return null;
  }
  if (depth > 64) {
    return { kind: "unknown" };
  }

  const kind = value.kind;
  if (kind === "void" || kind === "unknown" || kind === "null" || kind === "boolean" || kind === "number" || kind === "string") {
    return { kind };
  }

  if (kind === "array") {
    const itemShape = parseShapeNode(value.items, depth + 1);
    return itemShape ? { kind: "array", items: itemShape } : { kind: "array", items: { kind: "unknown" } };
  }

  if (kind === "object") {
    const fieldsInput = isRecord(value.fields) ? value.fields : {};
    const fields: Record<string, { shape: ShapeNode; optional?: boolean; nullable?: boolean }> = {};
    for (const [fieldName, fieldValue] of Object.entries(fieldsInput)) {
      if (!isRecord(fieldValue)) {
        continue;
      }
      const shape = parseShapeNode(fieldValue.shape, depth + 1);
      if (!shape) {
        continue;
      }
      fields[fieldName] = {
        shape,
        optional: fieldValue.optional === true || undefined,
        nullable: fieldValue.nullable === true || undefined,
      };
    }
    return { kind: "object", fields };
  }

  if (kind === "union") {
    if (!Array.isArray(value.variants)) {
      return { kind: "unknown" };
    }
    const variants = value.variants
      .map((variant) => parseShapeNode(variant, depth + 1))
      .filter((variant): variant is ShapeNode => variant !== null);
    if (variants.length === 0) {
      return { kind: "unknown" };
    }
    return { kind: "union", variants };
  }

  return null;
}

function sanitizeObservedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0) {
      unique.add(entry);
    }
  }
  return Array.from(unique).slice(0, 20);
}

export function coerceRegistry(value: unknown): Registry {
  if (!isRecord(value)) {
    return createEmptyRegistry();
  }

  const parsedVersion = Number(value.version);
  if (!Number.isFinite(parsedVersion) || parsedVersion <= 0 || parsedVersion > REGISTRY_VERSION) {
    return createEmptyRegistry();
  }

  const endpointsValue = isRecord(value.endpoints) ? value.endpoints : null;
  if (!endpointsValue) {
    return createEmptyRegistry();
  }

  const endpoints: Registry["endpoints"] = {};
  for (const [endpointKey, endpointValue] of Object.entries(endpointsValue)) {
    if (!isRecord(endpointValue)) {
      continue;
    }

    const responsesInput = isRecord(endpointValue.responses) ? endpointValue.responses : {};
    const responses: Record<string, ShapeNode> = {};
    for (const [statusKey, shapeValue] of Object.entries(responsesInput)) {
      const shape = parseShapeNode(shapeValue);
      if (!shape) {
        continue;
      }
      responses[statusKey] = serializeShape(shape);
    }

    if (Object.keys(responses).length === 0) {
      continue;
    }

    const metaInput = isRecord(endpointValue.meta) ? endpointValue.meta : {};
    const seenCount = Number(metaInput.seenCount);
    const lastSeenAt =
      typeof metaInput.lastSeenAt === "string" && !Number.isNaN(Date.parse(metaInput.lastSeenAt))
        ? metaInput.lastSeenAt
        : new Date(0).toISOString();

    endpoints[endpointKey] = {
      responses,
      meta: {
        seenCount: Number.isFinite(seenCount) && seenCount >= 0 ? seenCount : 0,
        lastSeenAt,
        observedPaths: sanitizeObservedPaths(metaInput.observedPaths),
      },
    };
  }

  return {
    version: REGISTRY_VERSION,
    endpoints,
  };
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
