"use client";

import { useQuery } from "convex/react";
import { Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useOnlineCount } from "@/lib/useOnlineCount";
import type { Retro } from "./types";

/** How many have the retro open, and during Intro and Vote how many have answered or voted. */
export function PresenceStatus({ retro, participantId }: { retro: Retro; participantId: string }) {
  const { slug, state } = retro;
  const online = useOnlineCount(slug, participantId);
  // Same subscription as the pulse card's.
  const pulse = useQuery(api.pulse.summary, state === "intro" ? { slug, participantId } : "skip");
  const voters = useQuery(api.votes.voterCount, state === "vote" ? { slug } : "skip");

  if (online === undefined) return null;
  const done = (n: number, verb: string) => `${n} ${n === 1 ? "has" : "have"} ${verb}`;
  const progress =
    pulse ? done(pulse.total, "answered") : voters !== undefined ? done(voters, "voted") : null;

  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground" aria-label="Participants">
      <Users className="size-4" aria-hidden />
      {online} online
      {progress && <span className="font-normal">· {progress}</span>}
    </p>
  );
}
