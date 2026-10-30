import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function findRetro(ctx: QueryCtx, slug: string): Promise<Doc<"retros"> | null> {
  return await ctx.db
    .query("retros")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export async function getRetroOrThrow(ctx: QueryCtx, slug: string): Promise<Doc<"retros">> {
  const retro = await findRetro(ctx, slug);
  if (!retro) throw new ConvexError("Retro not found.");
  return retro;
}

const PARTICIPANT_ID = /^[A-Za-z0-9-]{8,64}$/;

/** participantId is a pseudonymous browser key (no accounts by design, §3); only its shape is checked. */
export function assertParticipantId(participantId: string): void {
  if (!PARTICIPANT_ID.test(participantId)) throw new ConvexError("Invalid participant.");
}
