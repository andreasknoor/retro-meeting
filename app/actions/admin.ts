"use server";

import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Agenda } from "@/convex/lib/agenda";
import { type ActionResult, assertSlug, clearToken, failure, readToken, storeToken } from "./session";

// The admin token lives only in an HTTP-only cookie (§5): browser JavaScript never sees it,
// so every admin operation goes through these server functions.

export type AdminResult = ActionResult;

export async function adminLogin(slug: string, password: string): Promise<AdminResult> {
  assertSlug(slug);
  try {
    const { token, expiresAt } = await fetchAction(api.adminNode.login, { slug, password });
    await storeToken(slug, token, expiresAt);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function adminLogout(slug: string): Promise<void> {
  assertSlug(slug);
  const token = await readToken(slug);
  if (token) await fetchMutation(api.admin.logout, { token });
  await clearToken(slug);
}

export async function isAdmin(slug: string): Promise<boolean> {
  assertSlug(slug);
  const token = await readToken(slug);
  if (!token) return false;
  return await fetchQuery(api.admin.validate, { slug, token, now: Date.now() });
}

export async function adminSaveAgenda(slug: string, agenda: Agenda): Promise<AdminResult> {
  assertSlug(slug);
  try {
    await fetchMutation(api.admin.updateAgenda, { slug, token: await readToken(slug), agenda });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function adminSaveSettings(slug: string, adminControlsPhases: boolean): Promise<AdminResult> {
  assertSlug(slug);
  try {
    await fetchMutation(api.admin.updateSettings, { slug, token: await readToken(slug), adminControlsPhases });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function adminDeleteIdea(slug: string, ideaId: Id<"ideas">): Promise<AdminResult> {
  assertSlug(slug);
  try {
    await fetchMutation(api.admin.removeIdea, { slug, token: await readToken(slug), ideaId });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function adminDeleteAction(slug: string, actionId: Id<"actions">): Promise<AdminResult> {
  assertSlug(slug);
  try {
    await fetchMutation(api.admin.removeAction, { slug, token: await readToken(slug), actionId });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function adminDeleteRetro(slug: string, confirmName: string): Promise<AdminResult> {
  assertSlug(slug);
  try {
    await fetchMutation(api.admin.deleteRetro, { slug, token: await readToken(slug), confirmName });
    await clearToken(slug);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}
