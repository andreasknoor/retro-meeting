// The three fixed board columns (decision A.1). Shared by server and client.

export const COLUMNS = ["keep", "fix", "try"] as const;
export type Column = (typeof COLUMNS)[number];

export const COLUMN_META: Record<Column, { label: string; question: string }> = {
  keep: { label: "Keep", question: "What worked well?" },
  fix: { label: "Fix", question: "What got in the way?" },
  try: { label: "Try", question: "What should we try next?" },
};

export const IDEA_LIMITS = { text: 500, initials: 4 } as const;

/** Trimmed, upper-cased initials; empty string means none. */
export function normalizeInitials(raw: string): string {
  return raw.trim().toUpperCase();
}
