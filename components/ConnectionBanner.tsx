"use client";

import { useConvexConnectionState } from "convex/react";

/** Shown while the realtime connection is down; Convex queues changes and sends them on reconnect. */
export function ConnectionBanner() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  if (!hasEverConnected || isWebSocketConnected) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      Connection lost. Reconnecting… Your changes are sent as soon as the connection is back.
    </div>
  );
}
