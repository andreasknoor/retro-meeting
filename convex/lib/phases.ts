// Retro state machine (IMPLEMENTATION_PLAN.md §4.2/§4.3). Shared by server and client.
import { type Agenda, orderPhases, type Phase } from "./agenda";

export type RetroState = "not_started" | Phase | "finished";

/** -1 before the first phase, enabled.length once finished. */
export function phaseIndex(state: RetroState, enabled: readonly Phase[]): number {
  const phases = orderPhases(enabled);
  if (state === "not_started") return -1;
  if (state === "finished") return phases.length;
  return phases.indexOf(state);
}

export function nextState(state: RetroState, enabled: readonly Phase[]): RetroState {
  const phases = orderPhases(enabled);
  if (state === "finished") return "finished";
  return phases[phaseIndex(state, enabled) + 1] ?? "finished";
}

/** The phase "Back" returns to; null before the start and in the first phase. */
export function previousPhase(state: RetroState, enabled: readonly Phase[]): Phase | null {
  return orderPhases(enabled)[phaseIndex(state, enabled) - 1] ?? null;
}

/** True once `phase` is the current phase or lies behind (false if the phase is disabled). */
export function hasReached(state: RetroState, enabled: readonly Phase[], phase: Phase): boolean {
  return enabled.includes(phase) && phaseIndex(state, enabled) >= phaseIndex(phase, enabled);
}

/** "Make action" on an idea: only during Discuss, or after the end if Discuss is disabled (§4.7). */
export function canMakeActionFromIdea(state: RetroState, enabled: readonly Phase[]): boolean {
  return enabled.includes("discuss") ? state === "discuss" : state === "finished";
}

export type ScheduleRow = { phase: Phase; startMin: number; minutes: number };

/** Agenda rows with their start offsets in minutes. */
export function schedule(enabled: readonly Phase[], agenda: Agenda): ScheduleRow[] {
  let start = 0;
  return orderPhases(enabled).map((phase) => {
    const row = { phase, startMin: start, minutes: agenda[phase] };
    start += agenda[phase];
    return row;
  });
}
