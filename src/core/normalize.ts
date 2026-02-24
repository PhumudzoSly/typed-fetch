import type { DynamicSegmentPattern } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_PATTERN = /^\d+$/;
const HASH_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

function shouldParametrize(
  segment: string,
  patterns: DynamicSegmentPattern[]
): boolean {
  for (const pattern of patterns) {
    if (pattern === "numeric" && NUMERIC_PATTERN.test(segment)) {
      return true;
    }
    if (pattern === "uuid" && UUID_PATTERN.test(segment)) {
      return true;
    }
    if (pattern === "hash" && HASH_PATTERN.test(segment)) {
      return true;
    }
  }
  return false;
}

function normalizePathname(
  pathname: string,
  patterns: DynamicSegmentPattern[]
): string {
  const segments = pathname
    .replace(/\/+/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => (shouldParametrize(segment, patterns) ? ":param" : segment));

  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
}

function getUrl(input: RequestInfo | URL): URL | null {
  if (typeof input === "string") {
    if (/^\s*:\/\//.test(input)) {
      return null;
    }
    try {
      return new URL(input, "http://typed-fetch.local");
    } catch {
      return null;
    }
  }

  if (input instanceof URL) {
    return input;
  }

  try {
    const request = input as Request;
    return new URL(request.url, "http://typed-fetch.local");
  } catch {
    return null;
  }
}

export function normalizeEndpointKey(args: {
  input: RequestInfo | URL;
  method?: string;
  dynamicSegmentPatterns: DynamicSegmentPattern[];
}): string {
  const method = (args.method ?? "GET").toUpperCase();
  const parsed = getUrl(args.input);

  if (!parsed) {
    return `${method} /unknown`;
  }

  const pathname = normalizePathname(
    parsed.pathname,
    args.dynamicSegmentPatterns
  );
  const queryKeys = Array.from(new Set(Array.from(parsed.searchParams.keys())))
    .sort((a, b) => a.localeCompare(b))
    .join("&");

  if (!queryKeys) {
    return `${method} ${pathname}`;
  }

  return `${method} ${pathname}?${queryKeys}`;
}
