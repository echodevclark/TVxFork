import { describe, it, expect } from "vitest";
import { getCurrentProgram, isNowPlaying, getVisiblePrograms } from "@/utils/epg";
import { Program } from "@/types/iptv";

const prog = (title: string, startISO: string, endISO: string): Program => ({
  channelId: "c1",
  title,
  start: new Date(startISO),
  end: new Date(endISO),
});

const now = new Date("2026-07-05T10:30:00Z");

describe("isNowPlaying / getCurrentProgram", () => {
  const programs = [
    prog("Past", "2026-07-05T09:00:00Z", "2026-07-05T10:00:00Z"),
    prog("Live", "2026-07-05T10:00:00Z", "2026-07-05T11:00:00Z"),
    prog("Next", "2026-07-05T11:00:00Z", "2026-07-05T12:00:00Z"),
  ];

  it("identifies the currently airing program", () => {
    expect(isNowPlaying(programs[1], now)).toBe(true);
    expect(isNowPlaying(programs[0], now)).toBe(false);
    expect(getCurrentProgram(programs, now)?.title).toBe("Live");
  });

  it("returns null when nothing is airing", () => {
    expect(getCurrentProgram([programs[0], programs[2]], now)).toBeNull();
    expect(getCurrentProgram([], now)).toBeNull();
  });

  it("treats end time as exclusive and start as inclusive", () => {
    const boundary = prog("Boundary", "2026-07-05T10:30:00Z", "2026-07-05T11:00:00Z");
    expect(isNowPlaying(boundary, now)).toBe(true); // starts exactly now
    const ended = prog("Ended", "2026-07-05T10:00:00Z", "2026-07-05T10:30:00Z");
    expect(isNowPlaying(ended, now)).toBe(false); // ends exactly now
  });
});

describe("getVisiblePrograms", () => {
  const base = new Date("2026-07-05T10:00:00Z");

  it("keeps only programs overlapping the window, sorted by start", () => {
    const programs = [
      prog("Next", "2026-07-05T11:00:00Z", "2026-07-05T12:00:00Z"),
      prog("Live", "2026-07-05T10:00:00Z", "2026-07-05T11:00:00Z"),
      prog("WayLater", "2026-07-06T10:00:00Z", "2026-07-06T11:00:00Z"), // outside 24h
    ];
    const visible = getVisiblePrograms(programs, base, 24);
    expect(visible.map((p) => p.title)).toEqual(["Live", "Next"]);
  });

  it("de-duplicates programs with the same title and start", () => {
    const programs = [
      prog("Live", "2026-07-05T10:00:00Z", "2026-07-05T11:00:00Z"),
      prog("Live", "2026-07-05T10:00:00Z", "2026-07-05T11:00:00Z"),
    ];
    expect(getVisiblePrograms(programs, base, 24)).toHaveLength(1);
  });

  it("includes a program that started before the window but is still running", () => {
    const programs = [prog("Ongoing", "2026-07-05T09:30:00Z", "2026-07-05T10:30:00Z")];
    expect(getVisiblePrograms(programs, base, 24).map((p) => p.title)).toEqual(["Ongoing"]);
  });
});
