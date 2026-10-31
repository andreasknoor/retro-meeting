"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { toast } from "sonner";
import { changeIcebreaker } from "@/app/actions/retro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { IDEA_LIMITS } from "@/convex/lib/columns";
import { ICEBREAKER_MAX_LENGTH, randomIcebreaker } from "@/convex/lib/icebreakers";
import { focusArea } from "@/convex/lib/phases";
import { CHECKIN_LIMITS } from "@/convex/lib/validation";
import { loadInitials, saveInitials } from "@/lib/ideas";
import { cn } from "@/lib/utils";
import type { Retro } from "./types";

/**
 * The Check-in phase (v1.13): everyone writes a short answer to the question. Shown before the
 * start (question only) and during the phase. Whoever may switch phases can draw another
 * question or write their own until the phase is over.
 */
export function CheckinCard({ retro, participantId, canControl }: { retro: Retro; participantId: string; canControl: boolean }) {
  const { slug, state } = retro;
  const data = useQuery(api.checkin.list, { slug, participantId });
  const answer = useMutation(api.checkin.answer);
  const [text, setText] = useState<string | null>(null);
  const [initials, setInitials] = useState(loadInitials);

  if (!data?.question || (state !== "not_started" && state !== "checkin")) return null;
  const running = state === "checkin";
  const draft = text ?? data.mine?.text ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    saveInitials(initials);
    try {
      await answer({ slug, participantId, text: draft, initials });
      setText(null);
    } catch (err) {
      toast.error(err instanceof ConvexError ? String(err.data) : "Could not save your answer.");
    }
  }

  return (
    <Card className={cn(focusArea(state) === "checkin" && "ring-2 ring-primary")}>
      <CardHeader>
        <CardTitle className="text-sm font-bold tracking-[0.14em] text-muted-foreground uppercase">Check-in</CardTitle>
        <CardDescription className="text-xl font-semibold text-foreground">{data.question}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canControl && <QuestionControls slug={slug} question={data.question} />}

        {!running ? (
          <p className="text-sm text-muted-foreground">Answers open when the Check-in phase starts.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-wrap gap-2" aria-label="Your check-in answer">
            <Input
              aria-label="Your answer"
              placeholder="A short answer…"
              className="min-w-0 flex-1"
              maxLength={CHECKIN_LIMITS.answer}
              value={draft}
              onChange={(e) => setText(e.target.value)}
            />
            <Input
              aria-label="Initials for your answer"
              placeholder="Initials"
              className="w-24"
              maxLength={IDEA_LIMITS.initials}
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
            />
            <Button type="submit" disabled={!draft.trim() || draft.trim() === data.mine?.text}>
              {data.mine ? "Change answer" : "Answer"}
            </Button>
          </form>
        )}

        {running && !data.revealed && (
          <p className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "person has" : "people have"} answered. The answers show once you have answered too.
          </p>
        )}
        {data.revealed && data.answers.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Check-in answers">
            {data.answers.map((a, i) => (
              <li key={i} className={cn("rounded-xl bg-muted/60 px-3 py-2 text-sm", a.isMine && "ring-1 ring-primary/40")}>
                {a.text}
                {a.initials && (
                  <span className="ml-1.5 inline-block rounded-md bg-card px-1.5 text-[11px] font-bold text-muted-foreground">{a.initials}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionControls({ slug, question }: { slug: string; question: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string) {
    setBusy(true);
    const result = await changeIcebreaker(slug, next);
    setBusy(false);
    if (!result.ok) toast.error(result.error);
    else setEditing(false);
  }

  if (editing) {
    return (
      <form
        className="flex flex-wrap gap-2"
        aria-label="Own check-in question"
        onSubmit={(e) => {
          e.preventDefault();
          void save(draft);
        }}
      >
        <Input
          aria-label="Your question"
          className="min-w-0 flex-1"
          maxLength={ICEBREAKER_MAX_LENGTH}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          Use this question
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void save(randomIcebreaker(question))}>
        Another question
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
      >
        Write your own
      </Button>
    </div>
  );
}
