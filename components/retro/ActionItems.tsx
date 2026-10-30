"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { COLUMN_META } from "@/convex/lib/columns";
import { ACTION_LIMITS } from "@/convex/lib/validation";
import { formatDueDate } from "@/lib/format";
import type { ActionDraft, ActionItem, Retro } from "./types";

type Props = { retro: Retro; draft: ActionDraft | null; onClearDraft: () => void };

function errorText(err: unknown, fallback: string): string {
  return err instanceof ConvexError ? String(err.data) : fallback;
}

export function ActionItems({ retro, draft, onClearDraft }: Props) {
  const actions = useQuery(api.actions.list, { slug: retro.slug });
  const count = actions?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Action items</CardTitle>
        <CardDescription>
          Add an action here at any time. During the Discuss phase you can also use “Make action” on an idea. Each
          action needs an owner and a due date.
        </CardDescription>
        <CardAction className="rounded-full border bg-muted px-3 py-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {count === 0 ? "None yet" : `${count} ${count === 1 ? "action" : "actions"}`}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {/* Remounts for every "Make action" click so the form starts from that idea. */}
        <ActionForm key={draft?.requestId ?? "free"} slug={retro.slug} draft={draft} onClearDraft={onClearDraft} />
        <ul className="grid gap-2" aria-label="Actions">
          {actions?.map((action) => <ActionRow key={action.id} action={action} />)}
        </ul>
        {actions?.length === 0 && (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No actions yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionForm({ slug, draft, onClearDraft }: { slug: string; draft: ActionDraft | null; onClearDraft: () => void }) {
  const add = useMutation(api.actions.add);
  const [text, setText] = useState(draft?.text.slice(0, ACTION_LIMITS.text) ?? "");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const ownerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!draft) return;
    formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    ownerRef.current?.focus({ preventScroll: true });
  }, [draft]);

  const complete = Boolean(text.trim() && owner.trim() && dueDate);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) return;
    try {
      await add({ slug, text, owner, dueDate, ideaId: draft?.ideaId });
      setText("");
      setOwner("");
      setDueDate("");
      if (draft) onClearDraft();
    } catch (err) {
      toast.error(errorText(err, "Could not add the action."));
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-2" aria-label="New action">
      <div className="grid gap-2.5 md:grid-cols-[1fr_14rem_10rem_auto]">
        <Input aria-label="Action" placeholder="What will we do?" value={text} maxLength={ACTION_LIMITS.text} onChange={(e) => setText(e.target.value)} />
        <Input ref={ownerRef} aria-label="Owner" placeholder="Owner" value={owner} maxLength={ACTION_LIMITS.owner} onChange={(e) => setOwner(e.target.value)} />
        <Input aria-label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Button type="submit" disabled={!complete}>
          Add action
        </Button>
      </div>
      {draft && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          From {COLUMN_META[draft.column].label}: “{draft.text.length > 60 ? `${draft.text.slice(0, 60)}…` : draft.text}”
          <button type="button" aria-label="Unlink idea" onClick={onClearDraft} className="hover:text-destructive">
            ✕
          </button>
        </p>
      )}
    </form>
  );
}

function ActionRow({ action }: { action: ActionItem }) {
  const update = useMutation(api.actions.update);
  const remove = useMutation(api.actions.remove);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(action.text);
  const [owner, setOwner] = useState(action.owner);
  const [dueDate, setDueDate] = useState(action.dueDate);

  function startEditing() {
    setText(action.text);
    setOwner(action.owner);
    setDueDate(action.dueDate);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update({ actionId: action.id, text, owner, dueDate });
      setEditing(false);
    } catch (err) {
      toast.error(errorText(err, "Could not save the action."));
    }
  }

  if (editing) {
    return (
      <li className="rounded-xl border-[1.5px] border-primary p-3">
        <form onSubmit={save} className="grid gap-2.5 md:grid-cols-[1fr_12rem_10rem_auto_auto]" aria-label="Edit action">
          <Input aria-label="Action" value={text} maxLength={ACTION_LIMITS.text} onChange={(e) => setText(e.target.value)} />
          <Input aria-label="Owner" value={owner} maxLength={ACTION_LIMITS.owner} onChange={(e) => setOwner(e.target.value)} />
          <Input aria-label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button type="submit">Save</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="grid items-center gap-3 rounded-xl border-[1.5px] px-4 py-3 md:grid-cols-[1fr_12rem_8rem_auto]">
      <div className="min-w-0">
        <p className="font-semibold break-words">{action.text}</p>
        {action.idea && <p className="text-xs text-muted-foreground">from {COLUMN_META[action.idea.column].label}</p>}
      </div>
      <div>
        <span className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Owner</span>
        {action.owner}
      </div>
      <div>
        <span className="block text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Due</span>
        {formatDueDate(action.dueDate)}
      </div>
      <div className="flex gap-3 text-sm md:justify-end">
        <button type="button" onClick={startEditing} className="font-semibold text-primary">
          Edit
        </button>
        <button
          type="button"
          onClick={() => void remove({ actionId: action.id }).catch((err) => toast.error(errorText(err, "Could not delete the action.")))}
          className="text-muted-foreground hover:text-destructive"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
