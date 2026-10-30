import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { getParticipantId, resetParticipantCache, useParticipantId } from "./participant";

afterEach(() => {
  localStorage.clear();
  resetParticipantCache();
  vi.restoreAllMocks();
});

test("creates a UUID once and keeps it", () => {
  const id = getParticipantId();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  resetParticipantCache();
  expect(getParticipantId()).toBe(id);
});

test("falls back to a per-page id when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const id = getParticipantId();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(getParticipantId()).toBe(id);
});

test("useParticipantId returns the id in the browser", () => {
  const { result } = renderHook(() => useParticipantId());
  expect(result.current).toBe(getParticipantId());
});
