/**
 * Stable unique key for client-only rows (e.g. new gallery images).
 * Avoids relying on crypto.randomUUID() where it is missing (non-secure contexts).
 */
export function newClientRowKey(): string {
  const c = globalThis.crypto;
  if (c != null && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
