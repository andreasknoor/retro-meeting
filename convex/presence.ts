import { Presence } from "@convex-dev/presence";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertParticipantId, getRetroOrThrow } from "./lib/retroAccess";

// Who has the retro open (backlog F4). Heartbeats only touch the caller's own session row in the
// presence component, so they don't conflict with each other or with the retro's own writes.
// The function names are fixed by the component's usePresence hook (it calls presence:disconnect
// via sendBeacon when the tab closes).

export const presence = new Presence<Id<"retros">, string>(components.presence);

// The client sends a heartbeat every 10 s by default; a session counts as gone after 2.5×.
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 30_000;

/** `roomId` is the retro's slug (that's what the client knows); the room is keyed by its id. */
export const heartbeat = mutation({
  args: { roomId: v.string(), userId: v.string(), sessionId: v.string(), interval: v.number() },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, { roomId: slug, userId, sessionId, interval }) => {
    assertParticipantId(userId);
    if (sessionId.length > 300) throw new ConvexError("Invalid session.");
    const retro = await getRetroOrThrow(ctx, slug);
    const clamped = Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, interval));
    return await presence.heartbeat(ctx, retro._id, userId, sessionId, clamped);
  },
});

/**
 * Everyone in the room shares this subscription. Participant ids stay on the server (they let
 * their owner delete ideas and actions), so each entry only says whether that person is online.
 */
export const list = query({
  args: { roomToken: v.string() },
  returns: v.array(v.object({ userId: v.string(), online: v.boolean(), lastDisconnected: v.number() })),
  handler: async (ctx, { roomToken }) => {
    const people = await presence.list(ctx, roomToken);
    return people.map((p, i) => ({ userId: String(i), online: p.online, lastDisconnected: p.lastDisconnected }));
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    // No checks possible: sent with sendBeacon when the tab closes. The token itself is the secret.
    return await presence.disconnect(ctx, sessionToken);
  },
});
