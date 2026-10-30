"use node";

import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { newSession } from "./adminNode";
import { enforce } from "./lib/rateLimits";
import { validateRetroInput } from "./lib/validation";
import { phaseValidator } from "./schema";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
// 36^12 ≈ 62 bits, so links cannot be guessed (8 characters until v1.2; those links stay valid).
const SLUG_LENGTH = 12;
const MAX_SLUG_ATTEMPTS = 5;

export function generateSlug(): string {
  // 256 % 36 != 0, so drop bytes ≥ 252 to keep every character equally likely.
  let slug = "";
  while (slug.length < SLUG_LENGTH) {
    for (const byte of randomBytes(SLUG_LENGTH * 2)) {
      if (byte < 252 && slug.length < SLUG_LENGTH) slug += SLUG_ALPHABET[byte % 36];
    }
  }
  return slug;
}

export async function hashPassword(password: string, salt: Buffer): Promise<string> {
  return (await scryptAsync(password, salt, 64)).toString("hex");
}

export const create = action({
  args: {
    name: v.string(),
    subtitle: v.string(),
    date: v.string(),
    lengthMin: v.number(),
    facilitator: v.string(),
    enabledPhases: v.array(phaseValidator),
    password: v.string(),
    /** Only the admin may switch phases; default on (decision after v0.10). */
    adminControlsPhases: v.optional(v.boolean()),
  },
  /** The creator knows the password, so they get an admin session right away (auto-login). */
  returns: v.object({ slug: v.string(), token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const errors = validateRetroInput(args);
    if (errors.length > 0) throw new ConvexError(errors.join(" "));
    // Before hashing, so spam does not cost scrypt time.
    await enforce(ctx, "createRetro");

    const salt = randomBytes(16);
    const passwordHash = await hashPassword(args.password, salt);
    const { token, tokenHash, expiresAt } = newSession();

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = generateSlug();
      const inserted: boolean = await ctx.runMutation(internal.retros.insert, {
        slug,
        name: args.name.trim(),
        subtitle: args.subtitle.trim(),
        date: args.date,
        lengthMin: args.lengthMin,
        facilitator: args.facilitator.trim(),
        enabledPhases: args.enabledPhases,
        passwordHash,
        passwordSalt: salt.toString("hex"),
        adminControlsPhases: args.adminControlsPhases ?? true,
        session: { tokenHash, expiresAt },
      });
      if (inserted) return { slug, token, expiresAt };
    }
    throw new ConvexError("Could not create the retro. Please try again.");
  },
});
