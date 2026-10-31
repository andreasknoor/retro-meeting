// The three fixed board columns (decision A.1). Shared by server and client.

export const COLUMNS = ["keep", "fix", "try"] as const;
export type Column = (typeof COLUMNS)[number];

// Formats (v1.12): the board always has three columns with the same keys; a format only changes
// their labels and questions. Chosen when the retro is created; missing = Keep / Fix / Try.
export const TEMPLATES = ["keep_fix_try", "start_stop_continue", "mad_sad_glad"] as const;
export type Template = (typeof TEMPLATES)[number];

export const TEMPLATE_LABELS: Record<Template, string> = {
  keep_fix_try: "Keep / Fix / Try",
  start_stop_continue: "Start / Stop / Continue",
  mad_sad_glad: "Mad / Sad / Glad",
};

type ColumnMeta = Record<Column, { label: string; question: string }>;

const TEMPLATE_COLUMNS: Record<Template, ColumnMeta> = {
  keep_fix_try: {
    keep: { label: "Keep", question: "What worked well?" },
    fix: { label: "Fix", question: "What got in the way?" },
    try: { label: "Try", question: "What should we try next?" },
  },
  start_stop_continue: {
    keep: { label: "Start", question: "What should we start doing?" },
    fix: { label: "Stop", question: "What should we stop doing?" },
    try: { label: "Continue", question: "What should we keep doing?" },
  },
  mad_sad_glad: {
    keep: { label: "Mad", question: "What frustrated you?" },
    fix: { label: "Sad", question: "What disappointed you?" },
    try: { label: "Glad", question: "What made you happy?" },
  },
};

/** Labels and questions of the three columns for a retro's format. */
export function columnMeta(template: Template | null | undefined): ColumnMeta {
  return TEMPLATE_COLUMNS[template ?? "keep_fix_try"];
}

/** Keep / Fix / Try, the format of every retro created before v1.12. */
export const COLUMN_META = TEMPLATE_COLUMNS.keep_fix_try;

// Voting (v1.12): by default one vote per column; or a number of votes to spend freely, at most
// one per idea. Set when the retro is created.
export const FREE_VOTES = { min: 1, max: 10, default: 3 } as const;

// `perRetro` bounds every read of a retro's ideas; far above what a 30–90 minute retro produces.
// Only a flood of made-up participants gets past it, and the board then says so.
// `votesPerRetro` bounds every read of a retro's votes (one per participant and column, so
// 1000 voters); the board says so when counts may be incomplete.
export const IDEA_LIMITS = { text: 500, initials: 4, perRetro: 300, votesPerRetro: 3000 } as const;

/** Trimmed, upper-cased initials; empty string means none. */
export function normalizeInitials(raw: string): string {
  return raw.trim().toUpperCase();
}
