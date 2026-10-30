// Pulse check aggregation (§4.4). Shared by the server query and the client's optimistic update.

import type { RetroState } from "./phases";

// Generous cap for one retro's participants; keeps the summary query bounded.
export const MAX_PULSE_ANSWERS = 500;

export const SCORE_LABELS = { 1: "Bad", 2: "Poor", 3: "Okay", 4: "Good", 5: "Great" } as const;
export type Score = keyof typeof SCORE_LABELS;

export type PulseSummary = {
  /** counts[0] = number of 1s … counts[4] = number of 5s */
  counts: number[];
  total: number;
  /** One decimal place; null without answers. */
  average: number | null;
  mine: number | null;
};

/** Results show once you have answered, or when the retro has moved past the Intro phase. */
export function resultsVisible(state: RetroState, mine: number | null): boolean {
  return mine !== null || (state !== "not_started" && state !== "intro");
}

export function isScore(n: number): n is Score {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export function summarize(scores: readonly number[], mine: number | null): PulseSummary {
  const counts = [0, 0, 0, 0, 0];
  for (const s of scores) counts[s - 1]++;
  const total = scores.length;
  const average = total ? Math.round((scores.reduce((a, b) => a + b, 0) / total) * 10) / 10 : null;
  return { counts, total, average, mine };
}

/** The summary after the caller answers (or changes) their score. */
export function withAnswer(summary: PulseSummary, score: number): PulseSummary {
  const scores: number[] = [];
  summary.counts.forEach((n, i) => {
    for (let k = 0; k < n; k++) scores.push(i + 1);
  });
  if (summary.mine !== null) scores.splice(scores.indexOf(summary.mine), 1);
  scores.push(score);
  return summarize(scores, score);
}
