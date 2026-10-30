"use node";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { SESSION_TTL_MS } from "./lib/adminAuth";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

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
      attemptsLeft: number;
    } = await ctx.runMutation(internal.admin.beginAttempt, { slug });

    const expected = Buffer.from(attempt.passwordHash, "hex");
    const actual = await scryptAsync(password, Buffer.from(attempt.passwordSalt, "hex"), expected.length || 64);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const left = attempt.attemptsLeft;
      throw new ConvexError(
        left > 0
          ? `Wrong password. ${left} ${left === 1 ? "attempt" : "attempts"} left.`
          : "Wrong password. Too many failed attempts; try again in 15 minutes.",
      );
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await ctx.runMutation(internal.admin.finishLogin, {
      attemptId: attempt.attemptId,
      retroId: attempt.retroId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt,
    });
    return { token, expiresAt };
  },
});
