import { describe, expect, test } from "vitest";
import { type RetroInput, validateRetroInput } from "./validation";

const valid: RetroInput = {
  name: "Sprint 42 Retro",
  subtitle: "",
  date: "2026-10-28",
  lengthMin: 30,
  facilitator: "Alex",
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
  password: "secret1",
};

describe("validateRetroInput", () => {
  test("accepts valid input", () => {
    expect(validateRetroInput(valid)).toEqual([]);
  });

  test.each<[string, Partial<RetroInput>, string]>([
    ["empty name", { name: "   " }, "Name is required."],
    ["long name", { name: "x".repeat(81) }, "Name can have at most 80 characters."],
    ["long goal", { subtitle: "x".repeat(141) }, "Goal can have at most 140 characters."],
    ["bad date format", { date: "28.10.2026" }, "Date is invalid."],
    ["impossible date", { date: "2026-02-30" }, "Date is invalid."],
    ["odd length", { lengthMin: 37 }, "Length must be one of 30, 45, 60, 90 minutes."],
    ["empty facilitator", { facilitator: "" }, "Facilitator is required."],
    ["long facilitator", { facilitator: "x".repeat(61) }, "Facilitator can have at most 60 characters."],
    ["no brainstorm", { enabledPhases: ["intro", "vote"] }, "The Brainstorm phase is required."],
    ["short password", { password: "12345" }, "Password needs at least 6 characters."],
    ["huge password", { password: "x".repeat(201) }, "Password is too long."],
  ])("rejects %s", (_, patch, message) => {
    expect(validateRetroInput({ ...valid, ...patch })).toContain(message);
  });

  test("reports several problems at once", () => {
    expect(validateRetroInput({ ...valid, name: "", facilitator: "" })).toHaveLength(2);
  });
});
