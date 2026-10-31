"use client";

import { useQuery } from "convex/react";
import { Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useOnlineCount } from "@/lib/useOnlineCount";
import type { Retro } from "./types";

/** How many have the retro open, and in Check-in, Intro, Brainstorm and Vote how many have answered, added ideas or voted. */
export function PresenceStatus({ retro, participantId }: { retro: Retro; participantId: string }) {
  const { slug, state } = retro;
  const online = useOnlineCount(slug, participantId);
  // Same subscription as the pulse card's.
  const pulse = useQuery(api.pulse.summary, state === "intro" ? { slug, participantId } : "skip");
  // Same subscription as the check-in card's.
  const checkin = useQuery(api.checkin.list, state === "checkin" ? { slug, participantId } : "skip");
  const voters = useQuery(api.votes.voterCount, state === "vote" ? { slug } : "skip");
  // Anonymous nudge for quiet people (backlog 12): a count, never names.
  const contributors = useQuery(api.ideas.contributorCount, state === "brainstorm" ? { slug } : "skip");

  if (online === undefined) return null;
  const done = (n: number, verb: string) => `${n} ${n === 1 ? "has" : "have"} ${verb}`;
  let progress: string | null = null;
  if (checkin) progress = done(checkin.total, "answered");
  else if (pulse) progress = done(pulse.total, "answered");
  else if (contributors !== undefined) progress = done(contributors, "added ideas");
  else if (voters !== undefined) progress = done(voters, "voted");

  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground" aria-label="Participants">
      <Users className="size-4" aria-hidden />
      {online} online
      {progress && <span className="font-normal">· {progress}</span>}
    </p>
  );
}
