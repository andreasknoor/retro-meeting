// Phase order and agenda defaults (IMPLEMENTATION_PLAN.md §4.2). Shared by server and client.

// "checkin" (v1.13) is optional and off by default; retros created before have no time for it.
export const PHASES = ["checkin", "intro", "brainstorm", "vote", "discuss"] as const;
export type Phase = (typeof PHASES)[number];
export type Agenda = Record<Phase, number>;

export const PHASE_LABELS: Record<Phase, string> = {
  checkin: "Check-in",
  intro: "Intro & Pulse",
  brainstorm: "Brainstorm",
  vote: "Vote",
  discuss: "Discuss & Act",
};

export const LENGTH_PRESETS = [30, 45, 60, 90] as const;

// Template for a 30-minute retro with the four standard phases; the check-in adds 3 minutes
// before scaling, so it takes them proportionally from the others.
const BASE: Agenda = { checkin: 3, intro: 4, brainstorm: 8, vote: 5, discuss: 13 };

/**
 * Scales the 30-minute template to `lengthMin`, spread over the enabled phases.
 * Every enabled phase gets at least 1 minute; the rounding remainder goes to Discuss
 * (or the last enabled phase). Disabled phases get 0.
 */
export function calcAgenda(lengthMin: number, enabled: readonly Phase[]): Agenda {
  const active = PHASES.filter((p) => enabled.includes(p));
  const agenda: Agenda = { checkin: 0, intro: 0, brainstorm: 0, vote: 0, discuss: 0 };
  if (active.length === 0) return agenda;

  const baseSum = active.reduce((sum, p) => sum + BASE[p], 0);
  let used = 0;
  for (const p of active) {
    agenda[p] = Math.max(1, Math.round((BASE[p] * lengthMin) / baseSum));
    used += agenda[p];
  }
  const last = active.includes("discuss") ? "discuss" : active[active.length - 1];
  agenda[last] = Math.max(1, agenda[last] + lengthMin - used);
  return agenda;
}

/** A stored agenda with every phase set; retros created before v1.13 have no `checkin`. */
export function fullAgenda(agenda: Omit<Agenda, "checkin"> & { checkin?: number }): Agenda {
  return { ...agenda, checkin: agenda.checkin ?? 0 };
}

/** Minutes the agenda adds up to; can differ from the planned length after admin changes. */
export function agendaTotal(agenda: Agenda, enabled: readonly Phase[]): number {
  return PHASES.filter((p) => enabled.includes(p)).reduce((sum, p) => sum + agenda[p], 0);
}

/** Enabled phases in canonical order, without duplicates. */
export function orderPhases(enabled: readonly Phase[]): Phase[] {
  return PHASES.filter((p) => enabled.includes(p));
}
