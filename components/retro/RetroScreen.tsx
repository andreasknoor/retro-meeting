"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { adminDeleteAction, adminDeleteIdea, isAdmin } from "@/app/actions/admin";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { agendaTotal, PHASE_LABELS } from "@/convex/lib/agenda";
import { useParticipantId } from "@/lib/participant";
import { forgetRetro, rememberRetro } from "@/lib/recentRetros";
import { ActionItems } from "./ActionItems";
import { AgendaCard } from "./AgendaCard";
import { IdeaBoard } from "./IdeaBoard";
import { PhaseBar } from "./PhaseBar";
import { PresenceStatus } from "./PresenceStatus";
import { PulseCard } from "./PulseCard";
import { RetroHeader } from "./RetroHeader";
import { SummaryCard } from "./SummaryCard";
import type { ActionDraft, Retro } from "./types";

export function RetroScreen({ slug }: { slug: string }) {
  const retro = useQuery(api.retros.getBySlug, { slug });
  const participantId = useParticipantId();
  // Tells the phase bar whether Back or Reset discards votes. Not from ideas.list: its counts are
  // hidden while voting. Shared with the presence status.
  const voters = useQuery(api.votes.voterCount, { slug });
  const hasVotes = (voters ?? 0) > 0;
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [admin, setAdmin] = useAdminStatus(slug);

  useEffect(() => {
    if (retro) rememberRetro(slug);
    else if (retro === null) forgetRetro(slug);
  }, [retro, slug]);

  usePhaseChangeToast(retro?.state);

  if (retro === undefined) return <RetroLoading />;
  if (retro === null) return <RetroNotFound />;

  return (
    <>
      <RetroHeader {...retro} lengthMin={agendaTotal(retro.agenda, retro.enabledPhases)} isAdmin={admin} />
      <PhaseBar retro={retro} hasVotes={hasVotes} isAdmin={admin} onAdminLogin={() => setAdmin(true)}>
        {participantId && <PresenceStatus retro={retro} participantId={participantId} />}
      </PhaseBar>
      <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6">
        {retro.state === "finished" && (
          <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Retro finished: ideas and the pulse check are read-only; actions can still be edited and ticked off.{" "}
            {retro.adminControlsPhases && !admin ? "The admin can reopen it with Back." : "Use ← Back to reopen it."}
          </p>
        )}
        {participantId && retro.state === "finished" && <SummaryCard retro={retro} participantId={participantId} />}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          <AgendaCard retro={retro} />
          {participantId && retro.enabledPhases.includes("intro") && (
            <PulseCard retro={retro} participantId={participantId} />
          )}
        </div>
        {participantId && (
          <IdeaBoard
            retro={retro}
            participantId={participantId}
            onAdminDelete={
              admin
                ? async (idea) => {
                    const result = await adminDeleteIdea(slug, idea.id);
                    return result.ok ? null : result.error;
                  }
                : undefined
            }
            onMakeAction={(idea) =>
              setActionDraft((prev) => ({
                requestId: (prev?.requestId ?? 0) + 1,
                ideaId: idea.id,
                text: idea.text,
                column: idea.column,
              }))
            }
          />
        )}
        {participantId && (
          <ActionItems
            retro={retro}
            participantId={participantId}
            draft={actionDraft}
            onClearDraft={() => setActionDraft(null)}
            onAdminDelete={
              admin
                ? async (action) => {
                    const result = await adminDeleteAction(slug, action.id);
                    return result.ok ? null : result.error;
                  }
                : undefined
            }
          />
        )}
        <p className="text-center text-sm text-muted-foreground">
          Admin? <Link href={`/r/${slug}/admin`} className="font-semibold text-primary">Open admin area</Link>
        </p>
      </main>
    </>
  );
}

/** Whether this browser holds an admin session (HTTP-only cookie, checked on the server). */
function useAdminStatus(slug: string): [boolean, (admin: boolean) => void] {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isAdmin(slug).then(
      (ok) => !cancelled && setAdmin(ok),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return [admin, setAdmin];
}

/** Tells everyone when the phase changes (it may have been switched by someone else). */
function usePhaseChangeToast(state: Retro["state"] | undefined) {
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === undefined || state === undefined || before === state) return;
    if (state === "finished") toast("Retro finished");
    else if (state === "not_started") toast("Retro reset · ideas and actions kept");
    else toast(`Phase changed to ${PHASE_LABELS[state]}`);
  }, [state]);
}

export function RetroLoading() {
  return (
    <div className="bg-primary/90" aria-busy="true">
      <div className="mx-auto max-w-7xl px-4 py-10 text-primary-foreground/80">Loading retro…</div>
    </div>
  );
}

function RetroNotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Retro not found</CardTitle>
          <CardDescription>The link may be wrong, or the retro was deleted.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Go to start page
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
