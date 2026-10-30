import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type Retro = NonNullable<FunctionReturnType<typeof api.retros.getBySlug>>;

export type Idea = FunctionReturnType<typeof api.ideas.list>[number];
