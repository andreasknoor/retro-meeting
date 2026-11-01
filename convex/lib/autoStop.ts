// Forgotten retros (v1.16): the system pauses a phase that has run long into overtime with
// nothing happening, and finishes a retro nobody has touched for a day. Shared by the cron job
// (convex/autoStop.ts) and the tests.
import type { RetroState } from "./phases";

export const AUTO_STOP = {
  /** Pause once the phase is this far into overtime … */
  overtimeSec: 60 * 60,
  /** … and nothing has happened for this long. */
  idleBeforePauseMs: 60 * 60 * 1000,
  /** Finish after this long without activity, running or paused. */
  idleBeforeFinishMs: 24 * 60 * 60 * 1000,
} as const;

export type AutoStop = "paused" | "finished";

type Timer = { state: RetroState; phaseStartedAt?: number; phaseDurationSec?: number };

/** What the system does with a retro whose last activity was at `lastActivity`; null = nothing. */
export function autoStopAction(retro: Timer, lastActivity: number, now: number): AutoStop | null {
  if (retro.state === "not_started" || retro.state === "finished") return null;
  const idleMs = now - lastActivity;
  if (idleMs >= AUTO_STOP.idleBeforeFinishMs) return "finished";
  // Paused: the timer already stands still.
  if (retro.phaseStartedAt === undefined || retro.phaseDurationSec === undefined) return null;
  const overtimeSec = (now - retro.phaseStartedAt) / 1000 - retro.phaseDurationSec;
  return overtimeSec >= AUTO_STOP.overtimeSec && idleMs >= AUTO_STOP.idleBeforePauseMs ? "paused" : null;
}
