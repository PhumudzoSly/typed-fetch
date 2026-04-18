import * as http from "node:http";
import { observeManyToRegistryPath } from "./registry";
import type { ShapeNode } from "./types";

/**
 * Creates the HTTP observation server used by the `watch` CLI command.
 *
 * The server accepts POST requests to `/__typed-fetch/observe` from browser
 * runtimes and writes the observed shape to the local registry.
 *
 * @param registryPath  - Absolute path to the registry JSON file.
 * @param onObservation - Called after each successful registry write (e.g. to
 *                        schedule a type-generation run).
 */
export function createObserverServer(
  registryPath: string,
  onObservation: () => void,
): http.Server {
  return http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/__typed-fetch/observe") {
      const MAX_BODY_BYTES = 1_048_576; // 1 MB — guards against runaway clients
      let body = "";
      let bodyBytes = 0;
      let oversized = false;

      req.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(400);
          res.end();
        }
      });

      req.on("data", (chunk: Buffer) => {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          oversized = true;
          req.destroy();
          if (!res.headersSent) {
            res.writeHead(413);
            res.end();
          }
          return;
        }
        body += chunk.toString();
      });

      req.on("end", () => {
        if (oversized) return;
        try {
          const parsed = JSON.parse(body) as unknown;

          // Validate all required fields before touching the registry.
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            typeof (parsed as Record<string, unknown>).endpointKey !==
              "string" ||
            !(parsed as Record<string, unknown>).endpointKey ||
            typeof (parsed as Record<string, unknown>).status !== "number" ||
            !Number.isFinite((parsed as Record<string, unknown>).status) ||
            typeof (parsed as Record<string, unknown>).shape !== "object" ||
            (parsed as Record<string, unknown>).shape === null
          ) {
            res.writeHead(400);
            res.end();
            return;
          }

          const obs = parsed as {
            endpointKey: string;
            status: number;
            shape: ShapeNode;
            observedAt?: string;
            rawPath?: string;
          };

          observeManyToRegistryPath({
            registryPath,
            observations: [
              {
                endpointKey: obs.endpointKey,
                status: obs.status,
                shape: obs.shape,
                observedAt: obs.observedAt
                  ? new Date(obs.observedAt)
                  : undefined,
                rawPath: obs.rawPath,
              },
            ],
          });

          onObservation();
          res.writeHead(204);
          res.end();
        } catch {
          res.writeHead(400);
          res.end();
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });
}
