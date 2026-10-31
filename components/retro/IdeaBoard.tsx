"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { type Column, columnMeta, COLUMNS, IDEA_LIMITS, normalizeInitials } from "@/convex/lib/columns";
import { canMakeActionFromIdea, focusArea, hasReached } from "@/convex/lib/phases";
import { applyVoteToggle, loadInitials, saveInitials, sortIdeas, topIdea } from "@/lib/ideas";
import { cn } from "@/lib/utils";
import { IdeaCard } from "./IdeaCard";
import { IdeaComposer } from "./IdeaComposer";
import type { Idea, Retro } from "./types";

type Props = {
  retro: Retro;
  participantId: string;
  /** "Make action" on an idea (only enabled when the phase allows it). */
  onMakeAction: (idea: Idea) => void;
  /** Admins can delete any idea (§4.9); the call goes through a server action. */
  onAdminDelete?: (idea: Idea) => Promise<string | null>;
};

export function IdeaBoard({ retro, participantId, onMakeAction, onAdminDelete }: Props) {
  const { slug, state, enabledPhases } = retro;
  const meta = columnMeta(retro.template);
  // One vote per column (default), or votesPerPerson to spend freely, at most one per idea (v1.12).
  const perColumn = retro.votesPerPerson === null;
  const totalVotes = retro.votesPerPerson ?? COLUMNS.length;
  const ideas = useQuery(api.ideas.list, { slug, participantId });
  const addIdea = useMutation(api.ideas.add).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.ideas.list, { slug, participantId });
    if (!current) return;
    store.setQuery(api.ideas.list, { slug, participantId }, [
      ...current,
      {
        id: `optimistic-${current.length}` as Id<"ideas">,
        column: args.column,
        text: args.text.trim(),
        initials: normalizeInitials(args.initials) || null,
        voteCount: 0,
        createdAt: Number.MAX_SAFE_INTEGER, // sorts last until the server copy arrives
        isMine: true,
        votedByMe: false,
        hasAction: false,
      },
    ]);
  });
  const removeIdea = useMutation(api.ideas.remove);
  const toggleVote = useMutation(api.votes.toggle).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.ideas.list, { slug, participantId });
    if (current) store.setQuery(api.ideas.list, { slug, participantId }, applyVoteToggle(current, args.ideaId, perColumn));
  });

  const [initials, setInitials] = useState(loadInitials);
  const [mobileColumn, setMobileColumn] = useState<Column>("keep");

  const votingOn = enabledPhases.includes("vote");
  const votingOpen = state === "vote";
  // Counts and ranking only once voting is over, so late voters can't follow the trend (v1.7).
  const byVotes = hasReached(state, enabledPhases, "vote") && !votingOpen;
  const finished = state === "finished";
  const composerMuted = state !== "not_started" && state !== "brainstorm";
  const canMakeAction = canMakeActionFromIdea(state, enabledPhases);
  const myVotes = ideas?.filter((i) => i.votedByMe) ?? [];
  const votedColumns = new Set(myVotes.map((i) => i.column));
  const votesLeft = totalVotes - (perColumn ? votedColumns.size : myVotes.length);
  /** Whether a "+ Vote" on this idea would use a free vote (filled call to action) or not. */
  const canCastOn = (idea: Idea) => (perColumn ? !votedColumns.has(idea.column) : votesLeft > 0);

  async function add(column: Column, text: string): Promise<boolean> {
    saveInitials(initials);
    try {
      await addIdea({ slug, participantId, column, text, initials });
      return true;
    } catch (err) {
      toast.error(err instanceof ConvexError ? String(err.data) : "Could not add the idea.");
      return false;
    }
  }

  async function remove(idea: Idea) {
    try {
      if (idea.isMine) await removeIdea({ ideaId: idea.id, participantId });
      else {
        const error = await onAdminDelete?.(idea);
        if (error) throw new ConvexError(error);
      }
      toast("Idea deleted");
    } catch (err) {
      toast.error(err instanceof ConvexError ? String(err.data) : "Could not delete the idea.");
    }
  }

  async function vote(idea: Idea) {
    if (!idea.votedByMe && !perColumn && votesLeft <= 0) {
      toast.error("No votes left. Take one back first.");
      return;
    }
    try {
      const result = await toggleVote({ ideaId: idea.id, participantId });
      if (result === "moved") toast("Vote moved");
    } catch (err) {
      toast.error(err instanceof ConvexError ? String(err.data) : "Could not vote.");
    }
  }

  return (
    <Card className={cn(focusArea(state) === "board" && "ring-2 ring-primary")}>
      <CardHeader>
        <CardTitle className="text-xl">Idea board</CardTitle>
        <CardDescription>{boardHint(state, votingOn, byVotes, canMakeAction, retro.votesPerPerson)}</CardDescription>
        {votingOn && (
          <CardAction
            className={cn("flex items-center gap-1.5 text-sm font-bold", votingOpen ? "text-primary" : "text-muted-foreground")}
            aria-label="Votes left"
          >
            {perColumn
              ? COLUMNS.map((column) => (
                  <span
                    key={column}
                    title={meta[column].label}
                    className={cn("size-3 rounded-full border-2 border-current", votedColumns.has(column) && "bg-current")}
                  />
                ))
              : Array.from({ length: totalVotes }, (_, i) => (
                  <span key={i} className={cn("size-3 rounded-full border-2 border-current", i < myVotes.length && "bg-current")} />
                ))}
            <span className="ml-1">
              {votesLeft} of {totalVotes} {totalVotes === 1 ? "vote" : "votes"} left
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {ideas && ideas.reduce((sum, i) => sum + i.voteCount, 0) >= IDEA_LIMITS.votesPerRetro && (
          <p role="status" className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            This retro has too many votes to count them all; vote counts may be incomplete.
          </p>
        )}
        {ideas && ideas.length >= IDEA_LIMITS.perRetro && (
          <p role="status" className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            This retro has too many ideas to show them all; only the first {IDEA_LIMITS.perRetro} are shown.
          </p>
        )}
        <div className="mb-4 flex gap-2 md:hidden" role="tablist" aria-label="Columns">
          {COLUMNS.map((column) => (
            <button
              key={column}
              type="button"
              role="tab"
              aria-selected={mobileColumn === column}
              onClick={() => setMobileColumn(column)}
              className={cn(
                "flex-1 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold text-muted-foreground",
                mobileColumn === column && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {meta[column].label} ({ideas?.filter((i) => i.column === column).length ?? 0})
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((column) => {
            const sorted = sortIdeas(ideas?.filter((i) => i.column === column) ?? [], byVotes);
            const top = topIdea(sorted, byVotes);
            const { label, question } = meta[column];
            return (
              <section
                key={column}
                aria-label={label}
                className={cn("min-w-0 rounded-2xl bg-muted/60 p-4", mobileColumn !== column && "max-md:hidden")}
              >
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  {label}
                  <span className="rounded-full bg-card px-2 text-sm font-semibold text-muted-foreground">{sorted.length}</span>
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">{question}</p>
                {!finished && (
                  <IdeaComposer
                    label={label}
                    muted={composerMuted}
                    initials={initials}
                    onInitialsChange={setInitials}
                    onAdd={(text) => add(column, text)}
                  />
                )}
                <ul className="mt-3 grid gap-2.5">
                  {sorted.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      topLabel={idea === top ? label : null}
                      onDelete={(idea.isMine && !finished) || onAdminDelete ? () => void remove(idea) : undefined}
                      deleteWarning={deleteWarning(idea, votingOpen, byVotes)}
                      actions={
                        // Only where it does something; the board hint says when it becomes available.
                        canMakeAction && (
                          <button
                            type="button"
                            onClick={() => onMakeAction(idea)}
                            className={cn("text-sm font-semibold text-primary", idea.hasAction && "font-normal text-muted-foreground hover:text-primary")}
                          >
                            {idea.hasAction ? "+ Another action" : "Make action"}
                          </button>
                        )
                      }
                    >
                      {votingOpen && (
                        // A call to action like "Start Vote" while a vote is free for this card; once
                        // used up, the other cards only offer to move it (per column), so they step back.
                        <Button
                          size="sm"
                          variant={idea.votedByMe ? "secondary" : canCastOn(idea) ? "default" : "outline"}
                          aria-pressed={idea.votedByMe}
                          onClick={() => void vote(idea)}
                          className={cn("h-8 px-3.5 text-sm font-semibold", idea.votedByMe && "border-primary text-primary")}
                        >
                          {idea.votedByMe ? "✓ Voted" : "+ Vote"}
                        </Button>
                      )}
                      {votingOn && byVotes && (
                        <span className="text-sm font-bold">
                          {idea.voteCount} {idea.voteCount === 1 ? "vote" : "votes"}
                          {idea.votedByMe && <span className="ml-1.5 font-normal text-muted-foreground">· incl. yours</span>}
                        </span>
                      )}
                    </IdeaCard>
                  ))}
                </ul>
                {ideas !== undefined && sorted.length === 0 && (
                  <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No ideas yet</p>
                )}
              </section>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Shown in the delete confirmation when other people's votes would go too. */
function deleteWarning(idea: Idea, votingOpen: boolean, countsVisible: boolean): string | undefined {
  if (votingOpen) return "Votes on this idea will be lost.";
  if (countsVisible && idea.voteCount > 0) {
    return `Its ${idea.voteCount} ${idea.voteCount === 1 ? "vote" : "votes"} will be lost.`;
  }
  return undefined;
}

export function boardHint(
  state: Retro["state"],
  votingOn: boolean,
  byVotes: boolean,
  canMakeAction = false,
  votesPerPerson: number | null = null,
): string {
  const makeAction = canMakeAction ? " Use “Make action” to turn an idea into an action." : "";
  if (state === "vote") {
    const rules =
      votesPerPerson === null
        ? "one vote per column. Tap another idea to move your vote, or tap ✓ Voted to take it back."
        : `${votesPerPerson} ${votesPerPerson === 1 ? "vote" : "votes"} to spend freely, at most one per idea. Tap ✓ Voted to take one back.`;
    return `Voting is open: ${rules} Vote counts stay hidden until voting ends. Ideas added now may miss the votes already cast.`;
  }
  if (state === "finished") {
    return `${byVotes ? "Each column is ranked by votes. " : ""}The retro is finished, so the board is read-only.${makeAction}`;
  }
  if (byVotes) {
    return `Voting is closed. Each column is ranked by votes. New ideas can still be added, but they get no votes.${makeAction}`;
  }
  const base = votingOn
    ? "Add ideas to any column. Everyone sees them right away. Voting opens in the Vote phase."
    : "Add ideas to any column. Everyone sees them right away.";
  return `${base}${makeAction}`;
}
