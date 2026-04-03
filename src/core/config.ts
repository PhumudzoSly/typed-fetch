import type { TypedFetchConfig } from "./types";

const DEFAULT_CONFIG: TypedFetchConfig = {
  registryPath: ".typed-fetch/registry.json",
  generatedPath: "src/generated/typed-fetch.d.ts",
  include: [],
  exclude: [],
  dynamicSegmentPatterns: ["numeric", "uuid", "hash"],
  maxDepth: 8,
  maxArraySample: 32,
  ignoreFieldNames: ["password", "token", "secret", "authorization"],
  strictPrivacyMode: true,
  observerMode: "auto",
  observerPort: 7779,
};

type ConfigOverrides = Partial<TypedFetchConfig>;
export type LoadConfigOptions = {
  configPath?: string;
};

const CONFIG_FILE_NAME = "typed-fetch.config.json";

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

function loadFileConfig(options: LoadConfigOptions): ConfigOverrides {
  if (options.configPath) {
    return readJsonFileIfExists<ConfigOverrides>(options.configPath) ?? {};
  }
  return readJsonFileIfExists<ConfigOverrides>(CONFIG_FILE_NAME) ?? {};
}

export function loadConfig(
  overrides: ConfigOverrides = {},
  options: LoadConfigOptions = {}
): TypedFetchConfig {
  return { ...DEFAULT_CONFIG, ...loadFileConfig(options), ...overrides };
}

export function getDefaultConfig(): TypedFetchConfig {
  return { ...DEFAULT_CONFIG };
}
