import { Program } from "@/types/iptv";

// Shared "More Info" Google-search helpers. Previously duplicated across Poster.tsx and Index.tsx.

// Some EPG feeds encode `year` as a full date (e.g. 20230101); keep only the 4-digit year.
export const displayYear = (year?: number): string => {
  if (!year) return "";
  return typeof year === "number" && year > 9999 ? String(year).substring(0, 4) : String(year);
};

export const buildGoogleQuery = (program: Program): string => {
  const year = displayYear(program.year);
  return year ? `${program.title} (${year})` : program.title;
};

export const googleSearchUrl = (program: Program): string =>
  `https://www.google.com/search?q=${encodeURIComponent(buildGoogleQuery(program))}`;

export const openGoogleSearch = (program: Program): void => {
  window.open(googleSearchUrl(program), "_blank");
};
