"use client";

import { useState } from "react";
import { toast } from "sonner";
import { changeIcebreaker } from "@/app/actions/retro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ICEBREAKER_MAX_LENGTH, randomIcebreaker } from "@/convex/lib/icebreakers";
import type { Retro } from "./types";

/**
 * The check-in question (backlog 9), shown before the start and during Intro. Whoever may switch
 * phases can draw another question from the catalog or write their own; everyone sees the same one.
 */
export function IcebreakerCard({ retro, canControl }: { retro: Retro; canControl: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  if (!retro.icebreaker || (retro.state !== "not_started" && retro.state !== "intro")) return null;

  async function save(question: string) {
    setBusy(true);
    const result = await changeIcebreaker(retro.slug, question);
    setBusy(false);
    if (!result.ok) toast.error(result.error);
    else setEditing(false);
  }

  return (
    <Card className="border-primary/40 bg-secondary/40">
      <CardHeader>
        <CardTitle className="text-sm font-bold tracking-[0.14em] text-muted-foreground uppercase">Check-in</CardTitle>
        <CardDescription className="text-xl font-semibold text-foreground">{retro.icebreaker}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">One short answer each, in turn. Passing is fine.</p>
        {canControl &&
          (editing ? (
            <form
              className="flex flex-wrap gap-2"
              aria-label="Own check-in question"
              onSubmit={(e) => {
                e.preventDefault();
                void save(draft);
              }}
            >
              <Input
                aria-label="Your question"
                className="min-w-0 flex-1 bg-card"
                maxLength={ICEBREAKER_MAX_LENGTH}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" disabled={busy || !draft.trim()}>
                Use this question
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void save(randomIcebreaker(retro.icebreaker))}>
                Another question
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft("");
                  setEditing(true);
                }}
              >
                Write your own
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
