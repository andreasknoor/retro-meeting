import { describe, expect, test } from "vitest";
import { parseRetroLink, retroUrl } from "./slug";

describe("parseRetroLink", () => {
  test.each([
    ["k7f3q9xa", "k7f3q9xa"],
    ["  K7F3Q9XA ", "k7f3q9xa"],
    ["https://retro-meeting.vercel.app/r/k7f3q9xa", "k7f3q9xa"],
    ["https://retro-meeting.vercel.app/r/k7f3q9xa/admin", "k7f3q9xa"],
    ["https://retro-meeting.vercel.app/r/k7f3q9xa?x=1", "k7f3q9xa"],
    ["/r/k7f3q9xa", "k7f3q9xa"],
  ])("reads %s", (input, slug) => {
    expect(parseRetroLink(input)).toBe(slug);
  });

  test.each(["", "short", "k7f3q9xa1", "https://example.com/r/k7f3-9xa", "https://example.com/x/k7f3q9xa1"])(
    "rejects %s",
    (input) => {
      expect(parseRetroLink(input)).toBeNull();
    },
  );
});

test("retroUrl builds the share link", () => {
  expect(retroUrl("https://retro.example", "k7f3q9xa")).toBe("https://retro.example/r/k7f3q9xa");
});
