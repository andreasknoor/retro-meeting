import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { cookies } from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  adminDeleteIdea,
  adminDeleteRetro,
  adminLogin,
  adminLogout,
  adminSaveAgenda,
  adminSaveSettings,
  isAdmin,
} from "./admin";

vi.mock("convex/nextjs", () => ({ fetchAction: vi.fn(), fetchMutation: vi.fn(), fetchQuery: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const jar = new Map<string, string>();
const store = {
  get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  set: vi.fn((name: string, value: string) => jar.set(name, value)),
  delete: vi.fn((name: string) => jar.delete(name)),
};
const SLUG = "k7f3q9xa";
const COOKIE = "retro_admin_k7f3q9xa";

beforeEach(() => {
  vi.clearAllMocks();
  jar.clear();
  vi.mocked(cookies).mockResolvedValue(store as never);
});

describe("admin server actions", () => {
  test("login stores the token in an HTTP-only, strict cookie", async () => {
    vi.mocked(fetchAction).mockResolvedValue({ token: "tok", expiresAt: 2_000_000_000_000 });
    expect(await adminLogin(SLUG, "secret1")).toEqual({ ok: true });
    expect(store.set).toHaveBeenCalledWith(COOKIE, "tok", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/",
      expires: new Date(2_000_000_000_000),
    });
  });

  test("login passes the server's message through", async () => {
    vi.mocked(fetchAction).mockRejectedValueOnce(new ConvexError("Wrong password. 4 attempts left."));
    expect(await adminLogin(SLUG, "x")).toEqual({ ok: false, error: "Wrong password. 4 attempts left." });
    vi.mocked(fetchAction).mockRejectedValueOnce(new Error("network"));
    expect(await adminLogin(SLUG, "x")).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(store.set).not.toHaveBeenCalled();
  });

  test("rejects malformed slugs before touching cookies", async () => {
    await expect(adminLogin("../etc", "x")).rejects.toThrow("Invalid retro.");
    await expect(isAdmin("BAD")).rejects.toThrow("Invalid retro.");
  });

  test("isAdmin checks the cookie token with the server", async () => {
    expect(await isAdmin(SLUG)).toBe(false);
    expect(fetchQuery).not.toHaveBeenCalled();
    jar.set(COOKIE, "tok");
    vi.mocked(fetchQuery).mockResolvedValue(true);
    expect(await isAdmin(SLUG)).toBe(true);
    expect(fetchQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ slug: SLUG, token: "tok" }));
  });

  test("logout ends the session and removes the cookie", async () => {
    await adminLogout(SLUG);
    expect(fetchMutation).not.toHaveBeenCalled();
    jar.set(COOKIE, "tok");
    await adminLogout(SLUG);
    expect(fetchMutation).toHaveBeenCalledWith(expect.anything(), { token: "tok" });
    expect(jar.has(COOKIE)).toBe(false);
  });

  test("admin operations send the cookie token", async () => {
    jar.set(COOKIE, "tok");
    const agenda = { intro: 3, brainstorm: 10, vote: 5, discuss: 12 };
    expect(await adminSaveAgenda(SLUG, agenda)).toEqual({ ok: true });
    expect(fetchMutation).toHaveBeenLastCalledWith(expect.anything(), { slug: SLUG, token: "tok", agenda });
    expect(await adminDeleteIdea(SLUG, "i1" as never)).toEqual({ ok: true });
    expect(fetchMutation).toHaveBeenLastCalledWith(expect.anything(), { slug: SLUG, token: "tok", ideaId: "i1" });
    expect(await adminSaveSettings(SLUG, false)).toEqual({ ok: true });
    expect(fetchMutation).toHaveBeenLastCalledWith(expect.anything(), { slug: SLUG, token: "tok", adminControlsPhases: false });
  });

  test("deleting the retro also drops the cookie", async () => {
    jar.set(COOKIE, "tok");
    expect(await adminDeleteRetro(SLUG, "Sprint 42 Retro")).toEqual({ ok: true });
    expect(jar.has(COOKIE)).toBe(false);
  });

  test("operations report server errors", async () => {
    vi.mocked(fetchMutation).mockRejectedValue(new ConvexError("Your admin session has expired. Please log in again."));
    const expired = { ok: false, error: "Your admin session has expired. Please log in again." };
    expect(await adminSaveAgenda(SLUG, { intro: 1, brainstorm: 1, vote: 1, discuss: 1 })).toEqual(expired);
    expect(await adminDeleteIdea(SLUG, "i1" as never)).toEqual(expired);
    expect(await adminDeleteRetro(SLUG, "x")).toEqual(expired);
    expect(await adminSaveSettings(SLUG, true)).toEqual(expired);
  });
});
