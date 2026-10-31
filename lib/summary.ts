// The retro's result as Markdown (backlog 9): copied, downloaded or printed from the summary card.
import { COLUMN_META, COLUMNS, type Column } from "@/convex/lib/columns";
import { SCORE_LABELS, type Score } from "@/convex/lib/pulse";
import { formatDueDate, formatLongDate } from "./format";
import { sortIdeas } from "./ideas";

export type SummaryInput = {
  retro: { name: string; subtitle: string | null; date: string; facilitator: string; votingOn: boolean };
  /** null when the retro has no pulse check. */
  pulse: { counts: number[]; total: number; average: number | null } | null;
  ideas: { column: Column; text: string; voteCount: number; createdAt: number }[];
  actions: { text: string; owner: string; dueDate: string; done: boolean; ideaColumn: Column | null }[];
};

/** Keeps user text from turning into Markdown structure (headings, lists, links, emphasis). */
function escapeInline(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/([\\`*_[\]<>#|])/g, "\\$1");
}

export function summaryMarkdown({ retro, pulse, ideas, actions }: SummaryInput): string {
  const lines: string[] = [`# ${escapeInline(retro.name)}`, ""];
  if (retro.subtitle) lines.push(`_${escapeInline(retro.subtitle)}_`, "");
  lines.push(`${formatLongDate(retro.date)} · Facilitator: ${escapeInline(retro.facilitator)}`, "");

  if (pulse) {
    lines.push("## Pulse check", "");
    if (pulse.total === 0 || pulse.average === null) {
      lines.push("No answers.", "");
    } else {
      lines.push(`Average **${pulse.average.toFixed(1)}** from ${pulse.total} ${pulse.total === 1 ? "answer" : "answers"}`, "");
      for (const score of [5, 4, 3, 2, 1] as Score[]) lines.push(`- ${score} ${SCORE_LABELS[score]}: ${pulse.counts[score - 1]}`);
      lines.push("");
    }
  }

  lines.push("## Ideas", "");
  for (const column of COLUMNS) {
    const sorted = sortIdeas(
      ideas.filter((i) => i.column === column),
      retro.votingOn,
    );
    lines.push(`### ${COLUMN_META[column].label}`, "");
    if (sorted.length === 0) lines.push("No ideas.");
    for (const idea of sorted) {
      const votes = retro.votingOn ? ` (${idea.voteCount} ${idea.voteCount === 1 ? "vote" : "votes"})` : "";
      lines.push(`- ${escapeInline(idea.text)}${votes}`);
    }
    lines.push("");
  }

  lines.push("## Actions", "");
  if (actions.length === 0) lines.push("No actions.");
  for (const a of actions) {
    const due = a.dueDate ? `, due ${formatDueDate(a.dueDate)}` : "";
    const from = a.ideaColumn ? ` (from ${COLUMN_META[a.ideaColumn].label})` : "";
    lines.push(`- [${a.done ? "x" : " "}] ${escapeInline(a.text)}${from} — ${escapeInline(a.owner)}${due}`);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** A file name like "2026-10-28-sprint-42-retro.md". */
export function summaryFileName(name: string, date: string): string {
  const base = name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${date}-${base || "retro"}.md`;
}
