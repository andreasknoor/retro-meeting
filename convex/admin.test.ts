/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { SESSION_TTL_MS } from "./lib/adminAuth";
import { newTest } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const PASSWORD = "secret1";
const ALICE = "alice-0000";

afterEach(() => vi.useRealTimers());

async function setup() {
  const t = newTest(modules);
  const { slug } = await t.action(api.retrosNode.create, {
    name: "Sprint 42 Retro",
    subtitle: "",
    date: "2026-10-28",
    lengthMin: 30,
    facilitator: "Alex",
    enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
    password: PASSWORD,
  });
  const login = (password = PASSWORD, s = slug) => t.action(api.adminNode.login, { slug: s, password });
  return { t, slug, login };
}

describe("login", () => {
  test("the right password opens a session for this retro only", async () => {
    const { t, slug, login } = await setup();
    const { token, expiresAt } = await login();
    expect(token.length).toBeGreaterThan(30);
    const now = Date.now();
    expect(await t.query(api.admin.validate, { slug, token, now })).toBe(true);
    expect(await t.query(api.admin.validate, { slug, token: "forged", now })).toBe(false);
    expect(await t.query(api.admin.validate, { slug, token: "", now })).toBe(false);
    expect(await t.query(api.admin.validate, { slug: "missing1", token, now })).toBe(false);
    expect(await t.query(api.admin.validate, { slug, token, now: expiresAt + 1 })).toBe(false);
    expect(expiresAt - now).toBeLessThanOrEqual(SESSION_TTL_MS);

    const other = await t.action(api.retrosNode.create, {
      name: "Other", subtitle: "", date: "2026-10-28", lengthMin: 30, facilitator: "B", enabledPhases: ["brainstorm"], password: "other-pw",
    });
    expect(await t.query(api.admin.validate, { slug: other.slug, token, now })).toBe(false);
  });

  test("stores only a hash of the token", async () => {
    const { t, login } = await setup();
    const { token } = await login();
    const sessions = await t.run((ctx) => ctx.db.query("adminSessions").collect());
    expect(sessions).toHaveLength(2); // creator's auto-login + this login
    expect(JSON.stringify(sessions)).not.toContain(token);
  });

  test("locks out after 5 failed attempts and unlocks after 15 minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { login } = await setup();
    await expect(login("wrong")).rejects.toThrow("Wrong password. 4 attempts left.");
    await expect(login("wrong")).rejects.toThrow("3 attempts left");
    await expect(login("wrong")).rejects.toThrow("2 attempts left");
    await expect(login("wrong")).rejects.toThrow("1 attempt left.");
    await expect(login("wrong")).rejects.toThrow("Too many failed attempts; try again in 15 minutes.");
    await expect(login()).rejects.toThrow(/Too many failed attempts. Try again in 15 minutes\./);

    vi.advanceTimersByTime(14 * 60 * 1000);
    await expect(login()).rejects.toThrow(/Try again in 1 minute\./);
    vi.advanceTimersByTime(61 * 1000);
    await expect(login()).resolves.toHaveProperty("token");
  });

  test("successful logins do not count towards the lockout", async () => {
    const { login } = await setup();
    for (let i = 0; i < 6; i++) await login();
    await expect(login("wrong")).rejects.toThrow("4 attempts left");
  });

  test("unknown retro", async () => {
    const { login } = await setup();
    await expect(login(PASSWORD, "missing1")).rejects.toThrow("Retro not found.");
  });

  test("logout ends the session", async () => {
    const { t, slug, login } = await setup();
    const { token } = await login();
    await t.mutation(api.admin.logout, { token });
    await t.mutation(api.admin.logout, { token });
    expect(await t.query(api.admin.validate, { slug, token, now: Date.now() })).toBe(false);
  });
});

describe("admin operations", () => {
  test("update agenda times; disabled phases stay 0; validation", async () => {
    const { t, slug, login } = await setup();
    const { token } = await login();
    await t.mutation(api.admin.updateAgenda, { slug, token, agenda: { intro: 3, brainstorm: 10, vote: 5, discuss: 12 } });
    expect((await t.query(api.retros.getBySlug, { slug }))!.agenda).toEqual({ intro: 3, brainstorm: 10, vote: 5, discuss: 12 });

    for (const bad of [0, 1.5, 121]) {
      await expect(
        t.mutation(api.admin.updateAgenda, { slug, token, agenda: { intro: bad, brainstorm: 10, vote: 5, discuss: 12 } }),
      ).rejects.toThrow("Each phase needs between 1 and 120 whole minutes.");
    }
    await expect(
      t.mutation(api.admin.updateAgenda, { slug, token: "forged", agenda: { intro: 3, brainstorm: 10, vote: 5, discuss: 12 } }),
    ).rejects.toThrow("Your admin session has expired.");
  });

  test("changing the running phase's time moves its timer; extensions are kept", async () => {
    const { t, slug, login } = await setup();
    const { token } = await login();
    const agenda = { intro: 3, brainstorm: 10, vote: 5, discuss: 12 };
    await t.mutation(api.phase.startNext, { slug, from: "not_started", token });
    await t.mutation(api.phase.startNext, { slug, from: "intro", token });
    await t.mutation(api.phase.extend, { slug, from: "brainstorm", token });
    const before = (await t.query(api.retros.getBySlug, { slug }))!;
    await t.mutation(api.admin.updateAgenda, { slug, token, agenda: { ...before.agenda, ...agenda } });
    const after = (await t.query(api.retros.getBySlug, { slug }))!;
    expect(after.phaseDurationSec).toBe((10 + 1) * 60);
    expect(after.phaseStartedAt).toBe(before.phaseStartedAt);

    await t.mutation(api.phase.endEarly, { slug, from: "brainstorm", token });
    await t.mutation(api.admin.updateAgenda, { slug, token, agenda: { ...agenda, brainstorm: 20 } });
    expect((await t.query(api.retros.getBySlug, { slug }))!.phaseDurationSec).toBeNull();
  });

  test("switches who controls the phases", async () => {
    const { t, slug, login } = await setup();
    const { token } = await login();
    await t.mutation(api.admin.updateSettings, { slug, token, adminControlsPhases: false });
    expect((await t.query(api.retros.getBySlug, { slug }))!.adminControlsPhases).toBe(false);
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await expect(t.mutation(api.admin.updateSettings, { slug, token: "forged", adminControlsPhases: true })).rejects.toThrow(
      "Your admin session has expired.",
    );
  });

  test("ignores durations of disabled phases", async () => {
    const t = newTest(modules);
    const { slug } = await t.action(api.retrosNode.create, {
      name: "R", subtitle: "", date: "2026-10-28", lengthMin: 30, facilitator: "F", enabledPhases: ["brainstorm", "discuss"], password: PASSWORD,
    });
    const { token } = await t.action(api.adminNode.login, { slug, password: PASSWORD });
    await t.mutation(api.admin.updateAgenda, { slug, token, agenda: { intro: 0, brainstorm: 12, vote: 99, discuss: 18 } });
    expect((await t.query(api.retros.getBySlug, { slug }))!.agenda).toEqual({ intro: 0, brainstorm: 12, vote: 0, discuss: 18 });
  });

  test("admins can delete anyone's idea, but only in their retro", async () => {
    const { t, slug, login } = await setup();
    const { token } = await login();
    const ideaId = await t.mutation(api.ideas.add, { slug, participantId: ALICE, column: "keep", text: "Hers", initials: "" });
    const other = await t.action(api.retrosNode.create, {
      name: "Other", subtitle: "", date: "2026-10-28", lengthMin: 30, facilitator: "B", enabledPhases: ["brainstorm"], password: "other-pw",
    });
    const foreign = await t.mutation(api.ideas.add, { slug: other.slug, participantId: ALICE, column: "keep", text: "Foreign", initials: "" });

    await t.mutation(api.admin.removeIdea, { slug, token, ideaId: foreign });
    await t.mutation(api.admin.removeIdea, { slug, token, ideaId });
    expect(await t.query(api.ideas.list, { slug, participantId: ALICE })).toEqual([]);
    expect(await t.query(api.ideas.list, { slug: other.slug, participantId: ALICE })).toHaveLength(1);
  });

  test("admins can delete anyone's action, but only in their retro", async () => {
    const { t, slug, login } = await setup();
    const { token } = await login();
    const actionId = await t.mutation(api.actions.add, { slug, participantId: ALICE, text: "Hers", owner: "A", dueDate: "2099-11-01" });
    const other = await t.action(api.retrosNode.create, {
      name: "Other", subtitle: "", date: "2026-10-28", lengthMin: 30, facilitator: "B", enabledPhases: ["brainstorm"], password: "other-pw",
    });
    const foreign = await t.mutation(api.actions.add, {
      slug: other.slug, participantId: ALICE, text: "Foreign", owner: "A", dueDate: "2099-11-01",
    });

    await t.mutation(api.admin.removeAction, { slug, token, actionId: foreign });
    await t.mutation(api.admin.removeAction, { slug, token, actionId });
    expect(await t.query(api.actions.list, { slug, participantId: ALICE })).toEqual([]);
    expect(await t.query(api.actions.list, { slug: other.slug, participantId: ALICE })).toHaveLength(1);
    await expect(t.mutation(api.admin.removeAction, { slug, token: "forged", actionId: foreign })).rejects.toThrow(
      "Your admin session has expired.",
    );
  });

  test("delete retro needs the exact name and removes everything", async () => {
    vi.useFakeTimers();
    const { t, slug, login } = await setup();
    const { token } = await login();
    const ideaId = await t.mutation(api.ideas.add, { slug, participantId: ALICE, column: "keep", text: "Idea", initials: "" });
    await t.mutation(api.pulse.answer, { slug, participantId: ALICE, score: 4 });
    await t.mutation(api.actions.add, { slug, participantId: ALICE, text: "Do it", owner: "Alex", dueDate: "2099-11-01" });
    for (const from of ["not_started", "intro", "brainstorm"] as const) await t.mutation(api.phase.startNext, { slug, from, token });
    await t.mutation(api.votes.toggle, { ideaId, participantId: ALICE });
    await expect(login("wrong")).rejects.toThrow();

    await expect(t.mutation(api.admin.deleteRetro, { slug, token, confirmName: "sprint 42 retro" })).rejects.toThrow(
      "Type the retro name exactly to confirm.",
    );
    await t.mutation(api.admin.deleteRetro, { slug, token, confirmName: "Sprint 42 Retro" });
    expect(await t.query(api.retros.getBySlug, { slug })).toBeNull();

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(async (ctx) => {
      const counts: Record<string, number> = {};
      for (const table of ["retros", "ideas", "votes", "pulseAnswers", "actions", "adminSessions", "loginAttempts"] as const) {
        counts[table] = (await ctx.db.query(table).collect()).length;
      }
      return counts;
    });
    expect(left).toEqual({ retros: 0, ideas: 0, votes: 0, pulseAnswers: 0, actions: 0, adminSessions: 0, loginAttempts: 0 });
  });
});

test("purgeExpired removes expired sessions and day-old attempts", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { t, slug, login } = await setup();
  const { token } = await login();
  await expect(login("wrong")).rejects.toThrow();
  vi.advanceTimersByTime(25 * 60 * 60 * 1000);
  const fresh = await login();
  await t.mutation(internal.admin.purgeExpired, {});
  const now = Date.now();
  expect(await t.query(api.admin.validate, { slug, token, now })).toBe(false);
  expect(await t.query(api.admin.validate, { slug, token: fresh.token, now })).toBe(true);
  expect(await t.run((ctx) => ctx.db.query("loginAttempts").collect())).toHaveLength(1);
});
