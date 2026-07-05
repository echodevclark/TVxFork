import { describe, it, expect } from "vitest";
import { displayYear, buildGoogleQuery, googleSearchUrl } from "@/utils/search";
import { Program } from "@/types/iptv";

const prog = (title: string, year?: number): Program => ({
  channelId: "c1",
  title,
  start: new Date("2026-07-05T10:00:00Z"),
  end: new Date("2026-07-05T11:00:00Z"),
  year,
});

describe("displayYear", () => {
  it("returns an empty string when there is no year", () => {
    expect(displayYear(undefined)).toBe("");
    expect(displayYear(0)).toBe("");
  });

  it("passes through a normal 4-digit year", () => {
    expect(displayYear(1994)).toBe("1994");
  });

  it("truncates a full-date year to 4 digits", () => {
    expect(displayYear(20230101)).toBe("2023");
  });
});

describe("buildGoogleQuery", () => {
  it("appends the year when present", () => {
    expect(buildGoogleQuery(prog("Pulp Fiction", 1994))).toBe("Pulp Fiction (1994)");
  });

  it("omits the year when absent", () => {
    expect(buildGoogleQuery(prog("The News"))).toBe("The News");
  });
});

describe("googleSearchUrl", () => {
  it("URL-encodes the query", () => {
    expect(googleSearchUrl(prog("Pulp Fiction", 1994))).toBe(
      "https://www.google.com/search?q=Pulp%20Fiction%20(1994)"
    );
  });
});
