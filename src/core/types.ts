/**
 * A string of the form `"METHOD /path"`, e.g. `"GET /users/:id"`.
 * Used to type-check `endpointKey` options at the call site.
 */
export type EndpointKey = `${string} /${string}`;

export type ShapeNode =
  | { kind: "void" }
  | { kind: "unknown" }
  | { kind: "null" }
  | { kind: "boolean" }
  | { kind: "number" }
  | { kind: "string" }
  | { kind: "array"; items: ShapeNode }
  | { kind: "object"; fields: Record<string, ObjectField> }
  | { kind: "union"; variants: ShapeNode[] };

export type ObjectField = {
  shape: ShapeNode;
  optional?: boolean;
  nullable?: boolean;
};

export type EndpointBucket = {
  responses: Record<string, ShapeNode>;
  meta: {
    seenCount: number;
    lastSeenAt: string;
    observedPaths?: string[];
  };
};

export type Registry = {
  version: number;
  endpoints: Record<string, EndpointBucket>;
};

export type DynamicSegmentPattern = "numeric" | "uuid" | "hash";

export type TypedFetchConfig = {
  registryPath: string;
  generatedPath: string;
  include: string[];
  exclude: string[];
  dynamicSegmentPatterns: DynamicSegmentPattern[];
  maxDepth: number;
  maxArraySample: number;
  ignoreFieldNames: string[];
  strictPrivacyMode: boolean;
  observerMode: "auto" | "file" | "http" | "none";
  /**
   * Port for the local HTTP observer server started by `typed-fetch watch`.
   * The browser-side runtime posts observations here when running outside Node.
   * @default 7779
   */
  observerPort: number;
  /**
   * Manual type overrides for specific endpoint+status pairs.
   * Takes precedence over inferred shapes during generation.
   *
   * @example
   * { "GET /users/:id": { "200": "{ id: number; name: string }" } }
   */
  overrides?: Record<string, Record<string, string>>;
};

export type TypedFetchRequestInit = RequestInit;

export type TypedFetchSuccessStatuses =
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226;
