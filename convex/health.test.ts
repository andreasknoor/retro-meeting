/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("ping reports the backend as reachable", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.health.ping, {})).toEqual({ ok: true });
});
