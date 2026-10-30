import { expect, test } from "vitest";
import { formatDueDate, formatLongDate, formatShortDate, todayIso } from "./format";

test("formatShortDate", () => {
  expect(formatShortDate("2026-10-28")).toBe("Wed 28 Oct");
});

test("formatLongDate", () => {
  expect(formatLongDate("2026-10-28")).toBe("28 Oct 2026");
});

test("todayIso uses the local calendar day with zero padding", () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
});

test("formatDueDate", () => {
  expect(formatDueDate("2026-11-05")).toBe("05.11.2026");
});
