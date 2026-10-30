import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { findRetro } from "./retroAccess";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 5;

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
