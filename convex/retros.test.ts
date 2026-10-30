/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { generateSlug, hashPassword } from "./retrosNode";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const input = {
  name: "  Sprint 42 Retro ",
  subtitle: "Keep, fix, try",
  date: "2026-10-28",
  lengthMin: 45,
  facilitator: " Alex ",
  enabledPhases: ["discuss", "brainstorm", "intro"] as ("intro" | "brainstorm" | "vote" | "discuss")[],
  password: "secret1",
};

describe("retros.create", () => {
  test("creates a retro and returns its slug", async () => {
    const t = convexTest(schema, modules);
    const { slug } = await t.action(api.retrosNode.create, input);
    expect(slug).toMatch(/^[a-z0-9]{8}$/);

    const retro = await t.query(api.retros.getBySlug, { slug });
    expect(retro).toMatchObject({
      slug,
      name: "Sprint 42 Retro",
      subtitle: "Keep, fix, try",
      facilitator: "Alex",
      lengthMin: 45,
      enabledPhases: ["intro", "brainstorm", "discuss"],
      state: "not_started",
      phaseStartedAt: null,
      phaseDurationSec: null,
    });
    expect(Object.values(retro!.agenda).reduce((a, b) => a + b, 0)).toBe(45);
    expect(retro!.agenda.vote).toBe(0);
  });

  test("only the admin controls phases by default; can be switched off", async () => {
    const t = convexTest(schema, modules);
    const a = await t.action(api.retrosNode.create, input);
    const b = await t.action(api.retrosNode.create, { ...input, adminControlsPhases: false });
    expect((await t.query(api.retros.getBySlug, { slug: a.slug }))!.adminControlsPhases).toBe(true);
    expect((await t.query(api.retros.getBySlug, { slug: b.slug }))!.adminControlsPhases).toBe(false);
  });

  test("logs the creator in as admin right away", async () => {
    const t = convexTest(schema, modules);
    const { slug, token, expiresAt } = await t.action(api.retrosNode.create, input);
    expect(await t.query(api.admin.validate, { slug, token, now: expiresAt - 1 })).toBe(true);
    expect(await t.query(api.admin.validate, { slug, token, now: expiresAt + 1 })).toBe(false);
  });

  test("retros from before the setting let anyone control phases", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("retros", {
        slug: "legacy01", name: "Old", date: "2026-10-01", lengthMin: 30, facilitator: "F", enabledPhases: ["brainstorm"],
        agenda: { intro: 0, brainstorm: 30, vote: 0, discuss: 0 }, state: "not_started", passwordHash: "h", passwordSalt: "s",
      }),
    );
    expect((await t.query(api.retros.getBySlug, { slug: "legacy01" }))!.adminControlsPhases).toBe(false);
  });

  test("stores an empty goal as missing", async () => {
    const t = convexTest(schema, modules);
    const { slug } = await t.action(api.retrosNode.create, { ...input, subtitle: "  " });
    expect((await t.query(api.retros.getBySlug, { slug }))!.subtitle).toBeNull();
  });

  test("stores only a salted hash of the password", async () => {
    const t = convexTest(schema, modules);
    const { slug } = await t.action(api.retrosNode.create, input);
    const doc = await t.run((ctx) =>
      ctx.db.query("retros").withIndex("by_slug", (q) => q.eq("slug", slug)).unique(),
    );
    expect(doc!.passwordHash).not.toContain(input.password);
    expect(doc!.passwordHash).toBe(
      await hashPassword(input.password, Buffer.from(doc!.passwordSalt, "hex")),
    );
  });

  test("rejects invalid input with all problems", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.retrosNode.create, { ...input, name: "", password: "123" }),
    ).rejects.toThrow(/Name is required\..*Password needs at least 6 characters\./);
  });

  test("never returns the password hash or salt", async () => {
    const t = convexTest(schema, modules);
    const { slug } = await t.action(api.retrosNode.create, input);
    const json = JSON.stringify([
      await t.query(api.retros.getBySlug, { slug }),
      await t.query(api.retros.getManyBySlugs, { slugs: [slug] }),
    ]);
    expect(json).not.toMatch(/password/i);
  });
});

describe("retros.insert", () => {
  test("refuses a slug that already exists", async () => {
    const t = convexTest(schema, modules);
    const row = {
      slug: "abcdefgh",
      name: "A",
      subtitle: "",
      date: "2026-10-28",
      lengthMin: 30,
      facilitator: "F",
      enabledPhases: ["brainstorm" as const],
      passwordHash: "h",
      passwordSalt: "s",
      adminControlsPhases: false,
    };
    expect(await t.mutation(internal.retros.insert, row)).toBe(true);
    expect(await t.mutation(internal.retros.insert, row)).toBe(false);
  });
});

describe("retros.getBySlug", () => {
  test("returns null for an unknown slug", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.retros.getBySlug, { slug: "nope1234" })).toBeNull();
  });
});

describe("retros.getManyBySlugs", () => {
  test("returns summaries for known slugs and skips unknown ones", async () => {
    const t = convexTest(schema, modules);
    const a = await t.action(api.retrosNode.create, input);
    const b = await t.action(api.retrosNode.create, { ...input, name: "Other" });
    const list = await t.query(api.retros.getManyBySlugs, { slugs: [b.slug, "missing1", a.slug] });
    expect(list).toEqual([
      { slug: b.slug, name: "Other", date: "2026-10-28", facilitator: "Alex" },
      { slug: a.slug, name: "Sprint 42 Retro", date: "2026-10-28", facilitator: "Alex" },
    ]);
  });

  test("limits the number of slugs per request", async () => {
    const t = convexTest(schema, modules);
    const slugs = Array.from({ length: 51 }, (_, i) => `slug${i}`);
    await expect(t.query(api.retros.getManyBySlugs, { slugs })).rejects.toThrow(/At most 50/);
  });
});

describe("generateSlug", () => {
  test("produces 8 lowercase alphanumeric characters", () => {
    const slugs = new Set(Array.from({ length: 200 }, generateSlug));
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]{8}$/);
    expect(slugs.size).toBe(200);
  });
});
