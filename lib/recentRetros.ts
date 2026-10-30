// "Your recent retros": slugs this browser created or opened (IMPLEMENTATION_PLAN.md §4.8).
// Storage can be missing or throw (private mode, blocked site data), so every access is guarded.

const KEY = "retro:recent";
export const MAX_RECENT = 20;

/** Raw stored value; a stable string, so it works as a useSyncExternalStore snapshot. */
export function readRecentRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseRecent(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function loadRecent(): string[] {
  return parseRecent(readRecentRaw());
}

/** Notifies when another tab changes the list. */
export function subscribeRecent(onChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Moves `slug` to the front and keeps at most MAX_RECENT entries. */
export function rememberRetro(slug: string): string[] {
  const next = [slug, ...loadRecent().filter((s) => s !== slug)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not persisted; the list just won't survive a reload.
  }
  return next;
}

export function forgetRetro(slug: string): string[] {
  const next = loadRecent().filter((s) => s !== slug);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Same as above.
  }
  return next;
}
