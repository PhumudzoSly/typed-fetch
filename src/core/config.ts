import type { TypedFetchConfig } from "./types";

const DEFAULT_CONFIG: TypedFetchConfig = {
  registryPath: ".typed-fetch/registry.json",
  generatedPath: "generated/typed-fetch.d.ts",
  include: [],
  exclude: [],
  dynamicSegmentPatterns: ["numeric", "uuid", "hash"],
  maxDepth: 8,
  maxArraySample: 32,
  ignoreFieldNames: ["password", "token", "secret", "authorization"],
  strictPrivacyMode: true,
  observerMode: "auto",
  browserStorageKey: "__typed_fetch_registry__",
  syncTimeoutMs: 1500,
};

type ConfigOverrides = Partial<TypedFetchConfig>;

function readJsonFileIfExists<T>(path: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    if (!fs.existsSync(path)) {
      return null;
    }
    const raw = fs.readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadConfig(overrides: ConfigOverrides = {}): TypedFetchConfig {
  const fileConfig =
    readJsonFileIfExists<ConfigOverrides>("typed-fetch.config.json") ??
    readJsonFileIfExists<ConfigOverrides>("better-api.config.json") ??
    {};

  const merged: TypedFetchConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...overrides,
  };

  merged.ignoreFieldNames = merged.ignoreFieldNames.map((v) => v.toLowerCase());

  return merged;
}

export function getDefaultConfig(): TypedFetchConfig {
  return { ...DEFAULT_CONFIG };
}
