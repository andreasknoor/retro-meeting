"use server";

import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { cookies } from "next/headers";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Agenda } from "@/convex/lib/agenda";

// The admin token lives only in an HTTP-only cookie (§5): browser JavaScript never sees it,
// so every admin operation goes through these server functions.

export type AdminResult = { ok: true } | { ok: false; error: string };

const SLUG = /^[a-z0-9]{8}$/;
const cookieName = (slug: string) => `retro_admin_${slug}`;

function assertSlug(slug: string): void {
  if (!SLUG.test(slug)) throw new Error("Invalid retro.");
}

async function readToken(slug: string): Promise<string> {
  return (await cookies()).get(cookieName(slug))?.value ?? "";
}

function failure(err: unknown): AdminResult {
  return { ok: false, error: err instanceof ConvexError ? String(err.data) : "Something went wrong. Please try again." };
}

export async function adminLogin(slug: string, password: string): Promise<AdminResult> {
  assertSlug(slug);
  try {
    const { token, expiresAt } = await fetchAction(api.adminNode.login, { slug, password });
    (await cookies()).set(cookieName(slug), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: new Date(expiresAt),
    });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function adminLogout(slug: string): Promise<void> {
  assertSlug(slug);
  const token = await readToken(slug);
  if (token) await fetchMutation(api.admin.logout, { token });
  (await cookies()).delete(cookieName(slug));
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

export async function adminDeleteIdea(slug: string, ideaId: Id<"ideas">): Promise<AdminResult> {
  assertSlug(slug);
  try {
    await fetchMutation(api.admin.removeIdea, { slug, token: await readToken(slug), ideaId });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function adminDeleteRetro(slug: string, confirmName: string): Promise<AdminResult> {
  assertSlug(slug);
  try {
    await fetchMutation(api.admin.deleteRetro, { slug, token: await readToken(slug), confirmName });
    (await cookies()).delete(cookieName(slug));
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}
