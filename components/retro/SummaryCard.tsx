"use client";

import { useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { COLUMN_META, COLUMNS } from "@/convex/lib/columns";
import { formatDueDate } from "@/lib/format";
import { sortIdeas } from "@/lib/ideas";
import { summaryFileName, summaryMarkdown } from "@/lib/summary";
import { cn } from "@/lib/utils";
import type { Retro } from "./types";

/** The result of a finished retro, to copy, download or print (backlog 9). Same subscriptions as the cards above. */
export function SummaryCard({ retro, participantId }: { retro: Retro; participantId: string }) {
  const { slug } = retro;
  const hasPulse = retro.enabledPhases.includes("intro");
  const votingOn = retro.enabledPhases.includes("vote");
  const ideas = useQuery(api.ideas.list, { slug, participantId });
  const pulse = useQuery(api.pulse.summary, hasPulse ? { slug, participantId } : "skip");
  const actions = useQuery(api.actions.list, { slug, participantId });
  if (ideas === undefined || actions === undefined || (hasPulse && pulse === undefined)) return null;

  const markdown = summaryMarkdown({
    retro: { name: retro.name, subtitle: retro.subtitle, date: retro.date, facilitator: retro.facilitator, votingOn },
    pulse: hasPulse && pulse ? pulse : null,
    ideas,
    actions: actions.map((a) => ({ ...a, ideaColumn: a.idea?.column ?? null })),
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Summary copied as Markdown");
    } catch {
      toast.error("Copying is blocked in this browser. Use Download instead.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = summaryFileName(retro.name, retro.date);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card id="retro-summary" className="ring-2 ring-primary">
      <CardHeader>
        <CardTitle className="text-xl">Summary</CardTitle>
        <CardDescription>The result of this retro. Take it with you as Markdown or print it as PDF.</CardDescription>
        <CardAction className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            Copy as Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            Download .md
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-3">
        {hasPulse && pulse && (
          <section aria-label="Pulse result">
            <h3 className="mb-1 font-bold">Pulse check</h3>
            <p className="text-sm text-muted-foreground">
              {pulse.average === null
                ? "No answers."
                : `Average ${pulse.average.toFixed(1)} from ${pulse.total} ${pulse.total === 1 ? "answer" : "answers"}`}
            </p>
          </section>
        )}
        <section aria-label="Top ideas" className={cn(hasPulse ? "md:col-span-2" : "md:col-span-3")}>
          <h3 className="mb-1 font-bold">{votingOn ? "Top ideas" : "Ideas"}</h3>
          <ul className="grid gap-1 text-sm">
            {COLUMNS.map((column) => {
              const top = sortIdeas(
                ideas.filter((i) => i.column === column),
                votingOn,
              ).slice(0, 3);
              return (
                <li key={column}>
                  <span className="font-semibold">{COLUMN_META[column].label}:</span>{" "}
                  {top.length === 0
                    ? "–"
                    : top.map((i) => (votingOn ? `${i.text} (${i.voteCount})` : i.text)).join(" · ")}
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-label="Action summary" className="md:col-span-3">
          <h3 className="mb-1 font-bold">Actions</h3>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {actions.map((a) => (
                <li key={a.id} className={cn(a.done && "text-muted-foreground line-through")}>
                  {a.done ? "☑" : "☐"} {a.text} — {a.owner}
                  {a.dueDate && `, due ${formatDueDate(a.dueDate)}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
