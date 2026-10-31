"use client";

import { useMutation, useQuery } from "convex/react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { focusArea } from "@/convex/lib/phases";
import { MAX_PULSE_ANSWERS, SCORE_LABELS, type Score, withAnswer } from "@/convex/lib/pulse";
import { cn } from "@/lib/utils";
import type { Retro } from "./types";

const SCORES = [1, 2, 3, 4, 5] as const satisfies readonly Score[];

export function PulseCard({ retro, participantId }: { retro: Retro; participantId: string }) {
  const { slug } = retro;
  const summary = useQuery(api.pulse.summary, { slug, participantId });
  const answer = useMutation(api.pulse.answer).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.pulse.summary, { slug, participantId });
    if (!current) return;
    // Hidden results stay hidden until the server sends them; only "You answered" shows at once.
    const next = current.revealed ? { ...withAnswer(current, args.score), revealed: true } : { ...current, mine: args.score };
    store.setQuery(api.pulse.summary, { slug, participantId }, next);
  });

  const mine = summary?.mine ?? null;
  const readOnly = retro.state === "finished";
  const max = Math.max(1, ...(summary?.counts ?? []));

  return (
    <Card className={cn(focusArea(retro.state) === "pulse" && "ring-2 ring-primary")}>
      <CardHeader>
        <CardTitle className="text-xl">Pulse check</CardTitle>
        <CardDescription>How did the time since the last retro go for you?</CardDescription>
        {mine !== null && (
          <CardAction className="rounded-full bg-secondary px-3 py-1 text-xs font-bold tracking-wide text-secondary-foreground uppercase">
            You answered {mine}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Your score">
            {SCORES.map((score) => (
              <button
                key={score}
                type="button"
                aria-pressed={mine === score}
                disabled={readOnly}
                onClick={() => void answer({ slug, participantId, score })}
                className={cn(
                  "rounded-xl border-[1.5px] bg-card px-1 py-3 text-center transition-colors enabled:hover:border-primary disabled:cursor-not-allowed",
                  mine === score && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <span className="block text-2xl leading-tight font-bold">{score}</span>
                <span className={cn("text-xs text-muted-foreground", mine === score && "text-primary-foreground")}>
                  {SCORE_LABELS[score]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-sm text-muted-foreground">
            {readOnly
              ? "The retro is finished, so answers can no longer change."
              : "One answer per person, anonymous. Tap another number to change yours."}
          </p>
        </div>

        <div className="rounded-xl bg-muted/60 p-4" aria-live="polite">
          {summary && !summary.revealed && (
            <p className="mb-2 text-sm text-muted-foreground">
              Results show once you have answered, so others’ scores don’t sway yours.
            </p>
          )}
          {summary && summary.total >= MAX_PULSE_ANSWERS && (
            <p role="status" className="mb-2 text-sm text-muted-foreground">
              Too many answers to count them all; only the first {MAX_PULSE_ANSWERS} are included.
            </p>
          )}
          <p className="mb-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{summary?.average?.toFixed(1) ?? "–"}</span>
            <span className="text-muted-foreground">
              average · {summary?.total ?? 0} {summary?.total === 1 ? "person has" : "people have"} answered
            </span>
          </p>
          <ul className="grid gap-1.5" aria-label="Results">
            {[...SCORES].reverse().map((score) => {
              const count = summary?.counts[score - 1] ?? 0;
              return (
                <li
                  key={score}
                  className={cn(
                    "grid grid-cols-[4.5rem_1fr_1.5rem] items-center gap-2.5 text-sm",
                    mine === score && "font-bold text-primary",
                  )}
                >
                  <span>
                    {score} {SCORE_LABELS[score]}
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
