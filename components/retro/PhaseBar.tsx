"use client";

import { Check, Lock } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { adminLogin } from "@/app/actions/admin";
import { type PhaseCommand, switchPhase } from "@/app/actions/retro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orderPhases, PHASE_LABELS } from "@/convex/lib/agenda";
import { backDiscardsVotes, nextState, phaseIndex, previousPhase } from "@/convex/lib/phases";
import { formatClock, remainingSec } from "@/lib/timer";
import { useServerNow } from "@/lib/useServerClock";
import { cn } from "@/lib/utils";
import type { Retro } from "./types";

type Props = {
  retro: Retro;
  /** Whether this browser holds an admin session for the retro. */
  isAdmin: boolean;
  onAdminLogin: () => void;
};

export function PhaseBar({ retro, isAdmin, onAdminLogin }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);

  const { slug, state } = retro;
  const canControl = !retro.adminControlsPhases || isAdmin;

  async function run(command: PhaseCommand, options?: { discardVotes?: boolean }) {
    const result = await switchPhase(slug, command, state, options);
    if (!result.ok) toast.error(result.error);
  }

  function back() {
    // Going back before the Vote phase deletes the votes: warn only if there are any.
    if (backDiscardsVotes(state, retro.enabledPhases) && retro.hasVotes) setConfirmBack(true);
    else void run("back");
  }

  const phases = orderPhases(retro.enabledPhases);
  const current = phaseIndex(state, retro.enabledPhases);
  const next = nextState(state, retro.enabledPhases);
  const previous = previousPhase(state, retro.enabledPhases);
  const running = retro.phaseStartedAt !== null;

  return (
    <div className="z-10 border-b bg-card shadow-sm md:sticky md:top-0">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <ol className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:w-auto md:flex-wrap md:px-0" aria-label="Phases">
          {phases.map((phase, i) => (
            <Fragment key={phase}>
              {i > 0 && <li aria-hidden className="h-0.5 w-3 shrink-0 bg-border" />}
              <li
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border-[1.5px] border-transparent bg-muted py-1 pr-3 pl-1 text-sm font-semibold whitespace-nowrap text-muted-foreground",
                  i === current && "border-dashed border-primary bg-secondary text-secondary-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border bg-card text-xs",
                    i < current && "border-secondary bg-secondary text-primary",
                    i === current && "border-primary text-primary",
                  )}
                >
                  {i < current ? <Check className="size-3.5" aria-label="done" /> : i + 1}
                </span>
                {PHASE_LABELS[phase]}
                <span className="font-normal opacity-70">{retro.agenda[phase]} min</span>
              </li>
            </Fragment>
          ))}
        </ol>

        <PhaseTimer retro={retro} />

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {!canControl ? (
            <PhaseLock slug={slug} onAdminLogin={onAdminLogin} />
          ) : confirmBack && previous ? (
            <span
              role="alertdialog"
              aria-label="Confirm going back"
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 py-1 pr-1 pl-3 text-sm font-semibold text-amber-900"
            >
              ⚠ Going back to {PHASE_LABELS[previous]} deletes all votes.
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setConfirmBack(false);
                  void run("back", { discardVotes: true });
                }}
              >
                Delete votes &amp; go back
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmBack(false)}>
                Cancel
              </Button>
            </span>
          ) : confirmReset ? (
            <span className="flex items-center gap-2 rounded-full bg-destructive/10 py-1 pr-1 pl-3 text-sm font-semibold text-destructive">
              Reset phases? Data is kept.
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setConfirmReset(false);
                  void run("reset");
                }}
              >
                Reset
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={previous === null}
                title={previous ? `Back to ${PHASE_LABELS[previous]}` : undefined}
                aria-label={previous ? `Back to ${PHASE_LABELS[previous]}` : "Back"}
                onClick={back}
              >
                ← Back
              </Button>
              {state !== "finished" && (
                <Button onClick={() => void run("startNext")}>
                  {next === "finished" ? "Finish retro" : `Start ${PHASE_LABELS[next as keyof typeof PHASE_LABELS]}`}
                </Button>
              )}
              <Button variant="outline" disabled={!running} onClick={() => void run("extend")}>
                +1 min
              </Button>
              <Button variant="outline" disabled={!running} onClick={() => void run("endEarly")}>
                End early
              </Button>
              <Button variant="link" disabled={state === "not_started"} onClick={() => setConfirmReset(true)}>
                Reset
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shown instead of the controls when only the admin may switch phases. */
function PhaseLock({ slug, onAdminLogin }: { slug: string; onAdminLogin: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await adminLogin(slug, password);
    setBusy(false);
    setPassword("");
    if (result.ok) {
      toast.success("Logged in as admin");
      onAdminLogin();
    } else {
      toast.error(result.error);
    }
  }

  if (!open) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        The facilitator controls the phases.
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Lock className="size-3.5" /> Log in to control
        </Button>
      </span>
    );
  }
  return (
    <form onSubmit={login} className="flex flex-wrap items-center gap-2" aria-label="Admin login">
      <Input
        type="password"
        aria-label="Admin password"
        placeholder="Admin password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-44"
      />
      <Button type="submit" size="sm" disabled={busy || !password}>
        {busy ? "Checking…" : "Log in"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

function PhaseTimer({ retro }: { retro: Retro }) {
  const now = useServerNow();
  const phases = orderPhases(retro.enabledPhases);
  const { state, phaseStartedAt, phaseDurationSec } = retro;

  let label: string;
  let value: string;
  let tone: "idle" | "running" | "over" = "idle";
  if (state === "not_started") {
    label = "Not started";
    value = formatClock(retro.agenda[phases[0]] * 60);
  } else if (state === "finished") {
    label = "Finished";
    value = "00:00";
  } else if (phaseStartedAt === null || phaseDurationSec === null) {
    label = PHASE_LABELS[state];
    value = "Ended";
  } else {
    label = PHASE_LABELS[state];
    const left = remainingSec(phaseStartedAt, phaseDurationSec, now);
    value = formatClock(left);
    tone = left < 0 ? "over" : "running";
  }

  return (
    <div className="flex items-baseline gap-2.5" role="timer" aria-label={`${label} timer`}>
      <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</span>
      <span
        className={cn(
          "text-3xl font-bold tabular-nums",
          tone === "idle" && "text-muted-foreground/70",
          tone === "over" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}
