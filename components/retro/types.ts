import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type Retro = NonNullable<FunctionReturnType<typeof api.retros.getBySlug>>;

export type Idea = FunctionReturnType<typeof api.ideas.list>[number];

export type ActionItem = FunctionReturnType<typeof api.actions.list>[number];

/** "Make action" on an idea pre-fills the action form (§4.7). */
export type ActionDraft = { requestId: number; ideaId: Idea["id"]; text: string; column: Idea["column"] };
