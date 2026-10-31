"use server";

import { fetchAction, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Phase } from "@/convex/lib/agenda";
import type { Template } from "@/convex/lib/columns";
import type { RetroState } from "@/convex/lib/phases";
import { type ActionResult, assertSlug, failure, readToken, storeToken } from "./session";

export type CreateRetroInput = {
  name: string;
  subtitle: string;
  date: string;
  lengthMin: number;
  facilitator: string;
  enabledPhases: Phase[];
  password: string;
  adminControlsPhases: boolean;
  template?: Template;
  votesPerPerson?: number;
  icebreaker?: string;
};

/** Creates the retro and logs the creator in as admin (auto-login via the HTTP-only cookie). */
export async function createRetro(input: CreateRetroInput): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  try {
    const { slug, token, expiresAt } = await fetchAction(api.retrosNode.create, input);
    await storeToken(slug, token, expiresAt);
    return { ok: true, slug };
  } catch (err) {
    return failure(err);
  }
}

export type PhaseCommand = "startNext" | "back" | "extend" | "pause" | "resume" | "reset";

/**
 * Phase controls go through the server so the admin token (if any) can be read from the
 * cookie. Retros that let anyone switch simply get no token.
 */
export async function switchPhase(
  slug: string,
  command: PhaseCommand,
  from: RetroState,
  options: { discardVotes?: boolean } = {},
): Promise<ActionResult> {
  assertSlug(slug);
  try {
    const token = (await readToken(slug)) || undefined;
    if (command === "reset" || command === "back") {
      await fetchMutation(api.phase[command], { slug, from, token, discardVotes: options.discardVotes });
    }
    else await fetchMutation(api.phase[command], { slug, from, token });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/** "Another question" or an own one for the check-in; needs the admin cookie like phase controls. */
export async function changeIcebreaker(slug: string, question: string): Promise<ActionResult> {
  assertSlug(slug);
  try {
    const token = (await readToken(slug)) || undefined;
    await fetchMutation(api.phase.setIcebreaker, { slug, question, token });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}
