import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { findRetro } from "./retroAccess";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
// Failed logins slow down instead of locking (v1.7): a lock let anyone with the link shut the
// admin out. Failures in a row (since the last success, within the window) beyond the free ones
// make the next attempt wait 10 s, 20 s, 40 s, … up to 2 minutes.
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const FREE_FAILED_ATTEMPTS = 3;
const FIRST_DELAY_SEC = 10;
export const MAX_LOGIN_DELAY_SEC = 120;

/** Seconds the next attempt has to wait after `failures` failed attempts in a row. */
export function loginDelaySec(failures: number): number {
  if (failures < FREE_FAILED_ATTEMPTS) return 0;
  return Math.min(MAX_LOGIN_DELAY_SEC, FIRST_DELAY_SEC * 2 ** (failures - FREE_FAILED_ATTEMPTS));
}

/** Hex SHA-256 via Web Crypto (available in the Convex runtime, unlike node:crypto). */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The retro if `token` is a live admin session for it, otherwise null. */
export async function adminRetro(
  ctx: QueryCtx,
  slug: string,
  token: string,
  now: number,
): Promise<Doc<"retros"> | null> {
  if (!token) return null;
  const retro = await findRetro(ctx, slug);
  if (!retro) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  return session && session.retroId === retro._id && session.expiresAt > now ? retro : null;
}

export async function requireAdmin(ctx: QueryCtx, slug: string, token: string, now: number): Promise<Doc<"retros">> {
  const retro = await adminRetro(ctx, slug, token, now);
  if (!retro) throw new ConvexError("Your admin session has expired. Please log in again.");
  return retro;
}
