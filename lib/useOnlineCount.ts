"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

// Heartbeat for the presence status (v1.11). Unlike the presence component's own usePresence
// hook, a hidden tab stays online: in a meeting the retro often sits behind the video call.
// You go offline when the tab closes (sendBeacon) or after ~50 s without a heartbeat (2.5 × the
// interval, see convex/presence.ts). Background tabs may throttle timers to about one per minute,
// which this interval still covers; on becoming visible again we beat at once in case it lapsed.
export const HEARTBEAT_MS = 20_000;

/** How many people (browsers, not tabs) have the retro open; undefined until known. */
export function useOnlineCount(slug: string, participantId: string): number | undefined {
  const convex = useConvex();
  const heartbeat = useMutation(api.presence.heartbeat);
  const disconnect = useMutation(api.presence.disconnect);
  const [roomToken, setRoomToken] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    let sessionToken: string | null = null;
    let cancelled = false;
    let inFlight = false;

    async function beat() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await heartbeat({ roomId: slug, userId: participantId, sessionId, interval: HEARTBEAT_MS });
        sessionToken = result.sessionToken;
        if (cancelled) void disconnect({ sessionToken }).catch(() => {});
        else setRoomToken(result.roomToken);
      } catch {
        // Offline or the retro is gone; the next beat tries again.
      } finally {
        inFlight = false;
      }
    }

    function leave() {
      if (!sessionToken) return;
      // The page is going away, so a normal mutation may never be sent.
      const body = JSON.stringify({ path: "presence:disconnect", args: { sessionToken } });
      navigator.sendBeacon(`${convex.url}/api/mutation`, new Blob([body], { type: "application/json" }));
    }

    function onVisibilityChange() {
      if (!document.hidden) void beat();
    }

    void beat();
    const timer = setInterval(() => void beat(), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", leave);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", leave);
      if (sessionToken) void disconnect({ sessionToken }).catch(() => {});
    };
  }, [slug, participantId, heartbeat, disconnect, convex]);

  const people = useQuery(api.presence.list, roomToken ? { roomToken } : "skip");
  return people?.filter((p) => p.online).length;
}
