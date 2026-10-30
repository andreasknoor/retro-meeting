"use node";

import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { validateRetroInput } from "./lib/validation";
import { phaseValidator } from "./schema";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_LENGTH = 8;
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
  },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args) => {
    const errors = validateRetroInput(args);
    if (errors.length > 0) throw new ConvexError(errors.join(" "));

    const salt = randomBytes(16);
    const passwordHash = await hashPassword(args.password, salt);

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
      });
      if (inserted) return { slug };
    }
    throw new ConvexError("Could not create the retro. Please try again.");
  },
});
