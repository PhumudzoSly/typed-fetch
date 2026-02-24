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
  observerMode: "auto" | "file" | "localStorage" | "none";
  browserStorageKey: string;
  syncUrl?: string;
  syncTimeoutMs: number;
};

export type ObservationPayload = {
  endpointKey: string;
  status: number;
  shape: ShapeNode;
  observedAt: string;
  source: "node" | "browser";
};

export type RegistrySyncPayload =
  | { type: "observation"; observation: ObservationPayload }
  | { type: "registry"; registry: Registry };

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
