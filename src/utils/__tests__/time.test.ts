import { describe, it, expect } from "vitest";
import { formatDuration, minutesBetween, topOfHour, PX_PER_MINUTE } from "@/utils/time";

describe("formatDuration", () => {
  it("rounds to whole minutes", () => {
    const start = new Date("2026-07-05T10:00:00Z");
    expect(formatDuration(start, new Date("2026-07-05T10:30:00Z"))).toBe("30min");
    expect(formatDuration(start, new Date("2026-07-05T11:00:00Z"))).toBe("60min");
    // 29m40s rounds to 30
    expect(formatDuration(start, new Date("2026-07-05T10:29:40Z"))).toBe("30min");
  });
});

describe("minutesBetween", () => {
  it("returns fractional minutes and honors direction", () => {
    const a = new Date("2026-07-05T10:00:00Z");
    const b = new Date("2026-07-05T10:15:30Z");
    expect(minutesBetween(a, b)).toBeCloseTo(15.5, 5);
    expect(minutesBetween(b, a)).toBeCloseTo(-15.5, 5);
  });
});

describe("topOfHour", () => {
  it("zeroes minutes, seconds and ms without mutating the input", () => {
    const input = new Date("2026-07-05T10:37:42.123Z");
    const snapped = topOfHour(input);
    expect(snapped.getMinutes()).toBe(0);
    expect(snapped.getSeconds()).toBe(0);
    expect(snapped.getMilliseconds()).toBe(0);
    expect(snapped.getHours()).toBe(input.getHours());
    // original is untouched
    expect(input.getMinutes()).toBe(37);
  });
});

describe("PX_PER_MINUTE", () => {
  it("is the 4px/min the timeline layout assumes", () => {
    expect(PX_PER_MINUTE).toBe(4);
  });
});
