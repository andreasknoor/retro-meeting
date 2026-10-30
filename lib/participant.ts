"use client";

import { useSyncExternalStore } from "react";

// Anonymous, per-browser participant key (§3). Not an identity: it only lets the server keep
// one pulse answer / one vote per column per browser.

const KEY = "retro:participant";
let cached: string | null = null;

export function getParticipantId(): string {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
    if (!cached) {
      cached = crypto.randomUUID();
      localStorage.setItem(KEY, cached);
    }
  } catch {
    // Storage blocked: keep an id for this page load only.
    cached ??= crypto.randomUUID();
  }
  return cached;
}

/** For tests: forget the cached id. */
export function resetParticipantCache(): void {
  cached = null;
}

const noopSubscribe = () => () => {};

/** The participant id, or null during server rendering. */
export function useParticipantId(): string | null {
  return useSyncExternalStore(noopSubscribe, getParticipantId, () => null);
}
