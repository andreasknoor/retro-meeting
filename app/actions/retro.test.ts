import { fetchAction, fetchMutation } from "convex/nextjs";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { cookies } from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createRetro, switchPhase } from "./retro";

vi.mock("convex/nextjs", () => ({ fetchAction: vi.fn(), fetchMutation: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const jar = new Map<string, string>();
const store = {
  get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  set: vi.fn((name: string, value: string) => jar.set(name, value)),
};
const input = {
  name: "Sprint 42 Retro",
  subtitle: "",
  date: "2026-10-28",
  lengthMin: 30,
  facilitator: "Alex",
  enabledPhases: ["brainstorm" as const],
  password: "secret1",
  adminControlsPhases: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  jar.clear();
  vi.mocked(cookies).mockResolvedValue(store as never);
});

describe("createRetro", () => {
  test("creates the retro and stores the creator's admin session in the cookie", async () => {
    vi.mocked(fetchAction).mockResolvedValue({ slug: "k7f3q9xa", token: "tok", expiresAt: 2_000_000_000_000 });
    expect(await createRetro(input)).toEqual({ ok: true, slug: "k7f3q9xa" });
    expect(fetchAction).toHaveBeenCalledWith(expect.anything(), input);
    expect(store.set).toHaveBeenCalledWith("retro_admin_k7f3q9xa", "tok", expect.objectContaining({ httpOnly: true, sameSite: "strict" }));
  });

  test("passes validation errors through", async () => {
    vi.mocked(fetchAction).mockRejectedValue(new ConvexError("Name is required."));
    expect(await createRetro(input)).toEqual({ ok: false, error: "Name is required." });
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe("switchPhase", () => {
  test("sends the cookie token with the phase command", async () => {
    jar.set("retro_admin_k7f3q9xa", "tok");
    expect(await switchPhase("k7f3q9xa", "startNext", "intro")).toEqual({ ok: true });
    const [ref, args] = vi.mocked(fetchMutation).mock.calls[0];
    expect(getFunctionName(ref as never)).toBe("phase:startNext");
    expect(args).toEqual({ slug: "k7f3q9xa", from: "intro", token: "tok" });
  });

  test("reset takes no state; no cookie means no token", async () => {
    await switchPhase("k7f3q9xa", "reset", "vote");
    const [ref, args] = vi.mocked(fetchMutation).mock.calls[0];
    expect(getFunctionName(ref as never)).toBe("phase:reset");
    expect(args).toEqual({ slug: "k7f3q9xa", token: undefined });
  });

  test("reports a refusal", async () => {
    vi.mocked(fetchMutation).mockRejectedValue(new ConvexError("Only the admin can switch phases."));
    expect(await switchPhase("k7f3q9xa", "extend", "vote")).toEqual({ ok: false, error: "Only the admin can switch phases." });
    await expect(switchPhase("bad", "extend", "vote")).rejects.toThrow("Invalid retro.");
  });
});
