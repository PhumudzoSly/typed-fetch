import { coerceRegistry, createEmptyRegistry } from "./registry";
import type { Registry } from "./types";

function getStorage(): Storage | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage;
}

export function hasLocalStorage(): boolean {
  return getStorage() !== null;
}

export function loadBrowserRegistry(storageKey: string): Registry {
  const storage = getStorage();
  if (!storage) {
    return createEmptyRegistry();
  }

  const raw = storage.getItem(storageKey);
  if (!raw) {
    return createEmptyRegistry();
  }

  try {
    return coerceRegistry(JSON.parse(raw));
  } catch {
    return createEmptyRegistry();
  }
}

export function saveBrowserRegistry(storageKey: string, registry: Registry): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(storageKey, JSON.stringify(registry));
}

export function clearBrowserRegistry(storageKey: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(storageKey);
}

