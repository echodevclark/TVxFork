import { describe, it, expect } from "vitest";
import { formatChannelName, getChannelCategory } from "@/utils/channelFormat";

describe("formatChannelName", () => {
  it("strips trailing filler words", () => {
    expect(formatChannelName("Pulp Fiction Movies")).toBe("Pulp Fiction");
    expect(formatChannelName("The Tesla Files History")).toBe("The Tesla Files");
    expect(formatChannelName("Extreme Ironing Sports")).toBe("Extreme Ironing");
    expect(formatChannelName("Cosmos Documentary")).toBe("Cosmos");
  });

  it("does not strip 'documentaries' (plural) — preserves the original regex behavior", () => {
    // The existing regex lists `documentary` (singular) and `doc`, but neither matches
    // the whole word "documentaries", so it is intentionally left unchanged here.
    expect(formatChannelName("Cosmos Documentaries")).toBe("Cosmos Documentaries");
  });

  it("is case-insensitive and handles singular/plural", () => {
    expect(formatChannelName("Some Movie")).toBe("Some");
    expect(formatChannelName("Some SHOW")).toBe("Some");
  });

  it("leaves names without filler words untouched", () => {
    expect(formatChannelName("HBO")).toBe("HBO");
    expect(formatChannelName("The Hitchhiker's Guide to the Galaxy")).toBe(
      "The Hitchhiker's Guide to the Galaxy"
    );
  });
});

describe("getChannelCategory", () => {
  it("detects category from the name", () => {
    expect(getChannelCategory("Action Movies")).toBe("movie");
    expect(getChannelCategory("Comedy Shows")).toBe("show");
    expect(getChannelCategory("Extreme Sports")).toBe("sport");
    expect(getChannelCategory("Ancient History")).toBe("history");
    expect(getChannelCategory("Nature Documentaries")).toBe("doc");
  });

  it("falls back to the group when the name has no category", () => {
    expect(getChannelCategory("Channel 4", "Movies")).toBe("movie");
  });

  it("returns null when nothing matches", () => {
    expect(getChannelCategory("HBO")).toBeNull();
    expect(getChannelCategory("News 24", "General")).toBeNull();
  });

  it("applies a consistent precedence when multiple tokens match", () => {
    // movie is checked before show
    expect(getChannelCategory("Movie Show Channel")).toBe("movie");
  });
});
