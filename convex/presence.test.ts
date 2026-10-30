/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { newTest, seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const ALICE = "alice-0000";
const BOB = "bob-000000";

async function setup() {
  const t = newTest(modules);
  const slug = await seedRetro(t);
  const beat = (userId: string, sessionId = `${userId}-tab`) =>
    t.mutation(api.presence.heartbeat, { roomId: slug, userId, sessionId, interval: 10_000 });
  return { t, slug, beat };
}

describe("presence", () => {
  test("lists who is online without revealing participant ids", async () => {
    const { t, beat } = await setup();
    const { roomToken } = await beat(ALICE);
    await beat(ALICE, "alice-second-tab");
    await beat(BOB);
    const people = await t.query(api.presence.list, { roomToken });
    expect(people.filter((p) => p.online)).toHaveLength(2);
    expect(JSON.stringify(people)).not.toMatch(/alice|bob/);
  });

  test("a closed tab goes offline", async () => {
    const { t, beat } = await setup();
    const { roomToken, sessionToken } = await beat(ALICE);
    await beat(BOB);
    await t.mutation(api.presence.disconnect, { sessionToken });
    expect((await t.query(api.presence.list, { roomToken })).filter((p) => p.online)).toHaveLength(1);
  });

  test("rejects unknown retros and invalid participants", async () => {
    const { t, slug, beat } = await setup();
    await expect(
      t.mutation(api.presence.heartbeat, { roomId: "missing1", userId: ALICE, sessionId: "s", interval: 10_000 }),
    ).rejects.toThrow("Retro not found.");
    await expect(beat("x")).rejects.toThrow("Invalid participant.");
    await expect(
      t.mutation(api.presence.heartbeat, { roomId: slug, userId: ALICE, sessionId: "s".repeat(301), interval: 10_000 }),
    ).rejects.toThrow("Invalid session.");
  });
});
