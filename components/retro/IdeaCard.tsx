import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Idea } from "./types";

type Props = {
  idea: Idea;
  /** Column label when this is the column's top idea. */
  topLabel: string | null;
  /** Vote control etc. (M5/M6), rendered left in the action row. */
  children?: ReactNode;
  /** Extra actions rendered right before Delete. */
  actions?: ReactNode;
  onDelete?: () => void;
};

export function IdeaCard({ idea, topLabel, children, actions, onDelete }: Props) {
  return (
    <li
      className={cn(
        "animate-in rounded-xl border-2 border-transparent bg-card px-4 py-3 shadow-xs fade-in slide-in-from-top-1",
        topLabel && "border-primary",
      )}
    >
      {topLabel && (
        <span className="mb-2 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-primary-foreground uppercase">
          Top in {topLabel}
        </span>
      )}
      <p className="break-words whitespace-pre-wrap">
        {idea.text}
        {idea.initials && (
          <span className="ml-1.5 inline-block rounded-md bg-muted px-1.5 text-[11px] font-bold text-muted-foreground">
            {idea.initials}
          </span>
        )}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        {children}
        <span className="flex-1" />
        {actions}
        {onDelete && (
          <button type="button" onClick={onDelete} className="text-sm text-muted-foreground hover:text-destructive">
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
