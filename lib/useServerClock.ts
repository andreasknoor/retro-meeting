"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { clockOffset } from "./timer";

/**
 * Server time, re-rendering every `tickMs`. Measures the local clock's offset once on mount so
 * every participant sees the same countdown even if their device clock is off.
 */
export function useServerNow(tickMs = 250): number {
  const fetchNow = useAction(api.clock.now);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const sentAt = Date.now();
    fetchNow({}).then(
      (serverNow) => {
        if (!cancelled) setOffset(clockOffset(sentAt, serverNow, Date.now()));
      },
      () => {
        // Keep the local clock; the countdown may then be off by the device's drift.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchNow]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return now + offset;
}
