"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type Column, COLUMN_META, IDEA_LIMITS } from "@/convex/lib/columns";
import { cn } from "@/lib/utils";

type Props = {
  column: Column;
  muted: boolean;
  initials: string;
  onInitialsChange: (initials: string) => void;
  /** Resolves true when the idea was saved, so the draft can be cleared. */
  onAdd: (text: string) => Promise<boolean>;
};

export function IdeaComposer({ column, muted, initials, onInitialsChange, onAdd }: Props) {
  const [text, setText] = useState("");
  const label = COLUMN_META[column].label;

  async function submit() {
    if (!text.trim()) return;
    const draft = text;
    setText("");
    if (!(await onAdd(draft))) setText(draft);
  }

  return (
    <form
      className={cn("grid gap-2", muted && "opacity-70 focus-within:opacity-100")}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Textarea
        aria-label={`New idea for ${label}`}
        placeholder="Add an idea…"
        value={text}
        maxLength={IDEA_LIMITS.text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        className="min-h-16 bg-card"
      />
      <div className="flex items-center justify-between gap-2">
        <Input
          aria-label={`Initials for ${label}`}
          placeholder="Initials"
          value={initials}
          maxLength={IDEA_LIMITS.initials}
          onChange={(e) => onInitialsChange(e.target.value.toUpperCase())}
          className="w-24 bg-card"
        />
        <span className="hidden text-xs text-muted-foreground lg:inline">Enter to add</span>
        <Button type="submit" variant="outline" disabled={!text.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
}
