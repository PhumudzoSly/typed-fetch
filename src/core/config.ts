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
export type LoadConfigOptions = {
  configPath?: string;
};

const CONFIG_FILE_NAME = "typed-fetch.config.json";
const LEGACY_CONFIG_FILE_NAME = "better-api.config.json";
let hasWarnedLegacyConfig = false;

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

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function sanitizeConfig(candidate: Partial<TypedFetchConfig>): TypedFetchConfig {
  const ignoreFieldNames =
    asStringArray(candidate.ignoreFieldNames)?.map((value) => value.toLowerCase()) ??
    DEFAULT_CONFIG.ignoreFieldNames;
  const include = asStringArray(candidate.include) ?? DEFAULT_CONFIG.include;
  const exclude = asStringArray(candidate.exclude) ?? DEFAULT_CONFIG.exclude;

  const dynamicPatternsInput = asStringArray(candidate.dynamicSegmentPatterns);
  const dynamicPatterns = Array.from(
    new Set(
      (dynamicPatternsInput ?? DEFAULT_CONFIG.dynamicSegmentPatterns).filter(
        (pattern): pattern is TypedFetchConfig["dynamicSegmentPatterns"][number] =>
          pattern === "numeric" || pattern === "uuid" || pattern === "hash"
      )
    )
  );

  return {
    registryPath:
      typeof candidate.registryPath === "string" && candidate.registryPath.length > 0
        ? candidate.registryPath
        : DEFAULT_CONFIG.registryPath,
    generatedPath:
      typeof candidate.generatedPath === "string" && candidate.generatedPath.length > 0
        ? candidate.generatedPath
        : DEFAULT_CONFIG.generatedPath,
    include,
    exclude,
    dynamicSegmentPatterns:
      dynamicPatterns.length > 0 ? dynamicPatterns : DEFAULT_CONFIG.dynamicSegmentPatterns,
    maxDepth: isPositiveInteger(candidate.maxDepth) ? candidate.maxDepth : DEFAULT_CONFIG.maxDepth,
    maxArraySample: isPositiveInteger(candidate.maxArraySample)
      ? candidate.maxArraySample
      : DEFAULT_CONFIG.maxArraySample,
    ignoreFieldNames: Array.from(new Set(ignoreFieldNames)),
    strictPrivacyMode:
      typeof candidate.strictPrivacyMode === "boolean"
        ? candidate.strictPrivacyMode
        : DEFAULT_CONFIG.strictPrivacyMode,
    observerMode:
      candidate.observerMode === "auto" ||
      candidate.observerMode === "file" ||
      candidate.observerMode === "localStorage" ||
      candidate.observerMode === "none"
        ? candidate.observerMode
        : DEFAULT_CONFIG.observerMode,
    browserStorageKey:
      typeof candidate.browserStorageKey === "string" && candidate.browserStorageKey.length > 0
        ? candidate.browserStorageKey
        : DEFAULT_CONFIG.browserStorageKey,
    syncUrl:
      typeof candidate.syncUrl === "string" && candidate.syncUrl.length > 0
        ? candidate.syncUrl
        : DEFAULT_CONFIG.syncUrl,
    syncTimeoutMs: isPositiveInteger(candidate.syncTimeoutMs)
      ? candidate.syncTimeoutMs
      : DEFAULT_CONFIG.syncTimeoutMs,
  };
}

function loadFileConfig(options: LoadConfigOptions): ConfigOverrides {
  if (options.configPath) {
    return readJsonFileIfExists<ConfigOverrides>(options.configPath) ?? {};
  }

  const nextConfig = readJsonFileIfExists<ConfigOverrides>(CONFIG_FILE_NAME);
  if (nextConfig) {
    return nextConfig;
  }

  const legacyConfig = readJsonFileIfExists<ConfigOverrides>(LEGACY_CONFIG_FILE_NAME);
  if (legacyConfig) {
    if (!hasWarnedLegacyConfig) {
      hasWarnedLegacyConfig = true;
      process.emitWarning(
        `"${LEGACY_CONFIG_FILE_NAME}" is deprecated. Rename it to "${CONFIG_FILE_NAME}".`,
        { code: "TYPED_FETCH_CONFIG_DEPRECATED" }
      );
    }
    return legacyConfig;
  }

  return {};
}

export function loadConfig(
  overrides: ConfigOverrides = {},
  options: LoadConfigOptions = {}
): TypedFetchConfig {
  return sanitizeConfig({
    ...DEFAULT_CONFIG,
    ...loadFileConfig(options),
    ...overrides,
  });
}

export function getDefaultConfig(): TypedFetchConfig {
  return { ...DEFAULT_CONFIG };
}
