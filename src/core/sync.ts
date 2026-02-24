import type { ObservationPayload, RegistrySyncPayload } from "./types";

function getFetchFn(): typeof fetch | null {
  if (typeof fetch === "function") {
    return fetch.bind(globalThis);
  }
  return null;
}

export async function pushObservation(args: {
  syncUrl: string;
  observation: ObservationPayload;
  timeoutMs?: number;
}): Promise<void> {
  const fetchFn = getFetchFn();
  if (!fetchFn) {
    return;
  }

  const payload: RegistrySyncPayload = {
    type: "observation",
    observation: args.observation,
  };

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = args.timeoutMs ?? 1500;
  const timeoutId =
    controller !== null
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    await fetchFn(args.syncUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
  } catch {
    // Sync is best-effort and should never break request flow.
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}
