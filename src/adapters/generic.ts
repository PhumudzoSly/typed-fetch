import { queueRegistryObservation } from "../core/file-observer";
import { loadConfig } from "../core/config";
import { inferShape } from "../core/shape";
import { generateTypes } from "../generator";
import type { TypedFetchConfig } from "../core/types";

function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType?.toLowerCase().includes("application/json"));
}

// Debounced type generation — waits longer than the registry flush (40ms)
// so the registry is fully written before we read it back for generation.
let _generateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleGenerate(
  registryPath: string,
  generatedPath: string,
): void {
  if (_generateTimer) clearTimeout(_generateTimer);
  _generateTimer = setTimeout(() => {
    _generateTimer = null;
    try {
      generateTypes({ registryPath, generatedPath });
    } catch {
      // Never block
    }
  }, 200);
}

/**
 * Observe a `Response`, record its JSON shape to the typed-fetch registry,
 * and automatically regenerate the TypeScript types file.
 *
 * Use this as the foundation for custom server-side adapters. The Hono and
 * Next.js adapters are thin wrappers around this function.
 *
 * - Non-JSON responses are silently skipped.
 * - Disabled when `observerMode` is `"none"` (e.g. in production).
 * - Never throws — observation and generation failures never block responses.
 *
 * @param endpointKey - The endpoint key in `"METHOD /path/:param"` format.
 * @param response    - The `Response` object to observe (will be cloned).
 * @param config      - Optional config overrides (e.g. `registryPath`).
 *
 * @example
 * import { observeResponse } from "@phumudzo/typed-fetch/adapters/generic";
 *
 * const res = Response.json({ id: 1, name: "Alice" }, { status: 200 });
 * await observeResponse("GET /users/:id", res);
 */
export async function observeResponse(
  endpointKey: string,
  response: Response,
  config?: Partial<TypedFetchConfig>,
): Promise<void> {
  try {
    // Only observe and generate in development. Skip in production, test,
    // staging, or any other environment to avoid unnecessary file I/O and
    // to prevent .d.ts files from being rewritten outside of dev.
    if (process.env.NODE_ENV !== "development") return;

    const effectiveConfig = loadConfig(config ?? {});

    // "none" means observation is explicitly disabled via config.
    // "http" is browser-side only — not applicable for server adapters.
    const mode = effectiveConfig.observerMode;
    if (mode === "none" || mode === "http") return;

    const contentType = response.headers.get("content-type");
    if (!isJsonContentType(contentType)) return;

    const data = await response.clone().json();
    const shape = inferShape(data, effectiveConfig);

    queueRegistryObservation({
      registryPath: effectiveConfig.registryPath,
      observation: {
        endpointKey,
        status: response.status,
        shape,
        observedAt: new Date(),
      },
    });

    // Auto-regenerate the .d.ts after the registry flush settles.
    scheduleGenerate(effectiveConfig.registryPath, effectiveConfig.generatedPath);
  } catch {
    // Observation and generation failures must never block response handling.
  }
}
