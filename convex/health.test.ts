/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { newTest } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

test("ping reports the backend as reachable", async () => {
  const t = newTest(modules);
  expect(await t.query(api.health.ping, {})).toEqual({ ok: true });
});
