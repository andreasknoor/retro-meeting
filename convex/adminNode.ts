"use node";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { SESSION_TTL_MS } from "./lib/adminAuth";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** A new random session token plus what the database stores about it. */
export function newSession(): { token: string; tokenHash: string; expiresAt: number } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: Date.now() + SESSION_TTL_MS };
}

/**
 * Checks the admin password and opens a session. Returns the session token, which the Next.js
 * server stores in an HTTP-only cookie; only its SHA-256 hash is kept in the database.
 */
export const login = action({
  args: { slug: v.string(), password: v.string() },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, { slug, password }) => {
    const attempt: {
      attemptId: Id<"loginAttempts">;
      retroId: Id<"retros">;
      passwordHash: string;
      passwordSalt: string;
      nextDelaySec: number;
    } = await ctx.runMutation(internal.admin.beginAttempt, { slug });

    const expected = Buffer.from(attempt.passwordHash, "hex");
    const actual = await scryptAsync(password, Buffer.from(attempt.passwordSalt, "hex"), expected.length || 64);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const wait = attempt.nextDelaySec;
      throw new ConvexError(wait > 0 ? `Wrong password. Please wait ${wait} seconds before the next try.` : "Wrong password.");
    }

    const { token, tokenHash, expiresAt } = newSession();
    await ctx.runMutation(internal.admin.finishLogin, {
      attemptId: attempt.attemptId,
      retroId: attempt.retroId,
      tokenHash,
      expiresAt,
    });
    return { token, expiresAt };
  },
});
