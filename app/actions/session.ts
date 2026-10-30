// Server-only helpers for the admin session cookie, shared by the server actions in this folder.
// Not a "use server" module: nothing here is callable from the browser.
import { ConvexError } from "convex/values";
import { cookies } from "next/headers";
import { SLUG } from "@/lib/slug";

export type ActionResult = { ok: true } | { ok: false; error: string };

const cookieName = (slug: string) => `retro_admin_${slug}`;

export function assertSlug(slug: string): void {
  if (!SLUG.test(slug)) throw new Error("Invalid retro.");
}

export async function readToken(slug: string): Promise<string> {
  return (await cookies()).get(cookieName(slug))?.value ?? "";
}

/** HTTP-only, so browser JavaScript never sees the admin token (§5). */
export async function storeToken(slug: string, token: string, expiresAt: number): Promise<void> {
  (await cookies()).set(cookieName(slug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearToken(slug: string): Promise<void> {
  (await cookies()).delete(cookieName(slug));
}

export function failure(err: unknown): { ok: false; error: string } {
  return { ok: false, error: err instanceof ConvexError ? String(err.data) : "Something went wrong. Please try again." };
}
