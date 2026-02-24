import http from "http";
import { loadConfig } from "./core/config";
import { generateTypes } from "./generator";
import {
  coerceRegistry,
  loadRegistry,
  mergeRegistryInto,
  observeShape,
  saveRegistry,
} from "./core/registry";
import type { ObservationPayload, RegistrySyncPayload, TypedFetchConfig } from "./core/types";

type ListenerOptions = {
  port?: number;
  host?: string;
  config?: Partial<TypedFetchConfig>;
  generateOnSync?: boolean;
  generateDebounceMs?: number;
  allowNetwork?: boolean;
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("::ffff:127.")
  );
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      return true;
    }
    return isLoopbackAddress(url.hostname);
  } catch {
    return false;
  }
}

function setCorsForLocal(res: http.ServerResponse, originHeader?: string): void {
  if (originHeader && isLocalOrigin(originHeader)) {
    res.setHeader("access-control-allow-origin", originHeader);
    res.setHeader("vary", "origin");
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function applyObservation(registryPath: string, observation: ObservationPayload): void {
  const registry = loadRegistry(registryPath);
  observeShape({
    registry,
    endpointKey: observation.endpointKey,
    status: observation.status,
    shape: observation.shape,
    observedAt: new Date(observation.observedAt),
    rawPath: undefined,
  });
  saveRegistry(registryPath, registry);
}

function applyRegistry(registryPath: string, incomingRegistry: unknown): void {
  const registry = loadRegistry(registryPath);
  mergeRegistryInto(registry, coerceRegistry(incomingRegistry));
  saveRegistry(registryPath, registry);
}

export async function startListener(options: ListenerOptions = {}): Promise<{
  server: http.Server;
  port: number;
  stop: () => Promise<void>;
}> {
  const config = loadConfig(options.config);
  const port = options.port ?? 43111;
  const host = options.host ?? "127.0.0.1";
  const generateOnSync = options.generateOnSync ?? true;
  const generateDebounceMs = options.generateDebounceMs ?? 200;
  const allowNetwork = options.allowNetwork ?? false;

  let generateTimer: NodeJS.Timeout | null = null;
  const scheduleGenerate = (): void => {
    if (!generateOnSync) {
      return;
    }
    if (generateTimer) {
      clearTimeout(generateTimer);
    }
    generateTimer = setTimeout(() => {
      generateTimer = null;
      try {
        generateTypes(config);
      } catch {
        // Ignore generate failures in listener hot path.
      }
    }, generateDebounceMs);
  };

  const server = http.createServer(async (req, res) => {
    try {
      const remoteAddress = req.socket.remoteAddress;
      if (!allowNetwork && !isLoopbackAddress(remoteAddress)) {
        sendJson(res, 403, { ok: false, error: "Only loopback clients allowed" });
        return;
      }

      const originHeader = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      if (originHeader && !isLocalOrigin(originHeader)) {
        sendJson(res, 403, { ok: false, error: "Only local origins allowed" });
        return;
      }

      setCorsForLocal(res, originHeader);

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.setHeader("access-control-allow-methods", "POST,OPTIONS");
        res.setHeader("access-control-allow-headers", "content-type");
        res.end();
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && req.url === "/sync") {
        const raw = await readBody(req);
        const parsed = JSON.parse(raw) as RegistrySyncPayload;

        if (parsed.type === "observation") {
          applyObservation(config.registryPath, parsed.observation);
          scheduleGenerate();
          sendJson(res, 202, { ok: true, type: "observation" });
          return;
        }

        if (parsed.type === "registry") {
          applyRegistry(config.registryPath, parsed.registry);
          scheduleGenerate();
          sendJson(res, 202, { ok: true, type: "registry" });
          return;
        }

        sendJson(res, 400, { ok: false, error: "Invalid payload type" });
        return;
      }

      sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  const resolvedPort =
    typeof address === "object" && address !== null ? address.port : port;

  return {
    server,
    port: resolvedPort,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (generateTimer) {
            clearTimeout(generateTimer);
            generateTimer = null;
          }
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
