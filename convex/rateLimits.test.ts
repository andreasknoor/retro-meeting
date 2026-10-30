/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { rateLimiter } from "./lib/rateLimits";
import { newTest, seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const participant = (i: number) => `person-${String(i).padStart(4, "0")}`;

// Frozen clock: token buckets do not refill while a test runs.
afterEach(() => vi.useRealTimers());

describe("rate limits", () => {
  test("creating retros is limited globally, before any hashing", async () => {
    const t = newTest(modules);
    await t.run(async (ctx) => {
      await rateLimiter.limit(ctx, "createRetro", { count: 60 });
    });
    await expect(
      t.action(api.retrosNode.create, {
        name: "Spam", subtitle: "", date: "2026-10-28", lengthMin: 30, facilitator: "F", enabledPhases: ["brainstorm"], password: "secret1",
      }),
    ).rejects.toThrow("Too many new retros right now.");
  });

  test("one participant writing very fast is slowed down, across answers, ideas and actions", async () => {
    vi.useFakeTimers();
    const t = newTest(modules);
    const slug = await seedRetro(t);
    const answer = () => t.mutation(api.pulse.answer, { slug, participantId: participant(1), score: 3 });
    for (let i = 0; i < 30; i++) await answer();
    await expect(answer()).rejects.toThrow("You're going too fast.");
    // Someone else is not affected.
    await expect(t.mutation(api.pulse.answer, { slug, participantId: participant(2), score: 4 })).resolves.toBeNull();
    await expect(
      t.mutation(api.ideas.add, { slug, participantId: participant(1), column: "keep", text: "More", initials: "" }),
    ).rejects.toThrow("You're going too fast.");
    await expect(
      t.mutation(api.actions.add, { slug, participantId: participant(1), text: "More", owner: "A", dueDate: "2099-11-01" }),
    ).rejects.toThrow("You're going too fast.");
    // Refills over time.
    vi.advanceTimersByTime(5_000);
    await expect(answer()).resolves.toBeNull();
  });
});
