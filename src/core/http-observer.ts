import type { ShapeNode } from "./types";

export type HttpObservation = {
  endpointKey: string;
  status: number;
  shape: ShapeNode;
  observedAt: string;
  rawPath?: string;
};

/**
 * Posts a single observation to the local typed-fetch watch server.
 * Designed to run in browser environments where file-system access is unavailable.
 * Fire-and-forget: never throws, never blocks the calling request.
 */
export function postObservationToServer(args: {
  observerPort: number;
  observation: HttpObservation;
}): void {
  try {
    void fetch(
      `http://localhost:${args.observerPort}/__typed-fetch/observe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.observation),
      },
    );
  } catch {
    // Observer server may not be running — never break request flow.
  }
}
