import { Program } from "@/types/iptv";

// Shared EPG program helpers. Previously inlined 7+ times across Index.tsx and EPGView.tsx.

export const isNowPlaying = (program: Program, now: Date = new Date()): boolean =>
  program.start <= now && program.end > now;

export const getCurrentProgram = (
  programs: Program[],
  now: Date = new Date()
): Program | null => programs.find((p) => isNowPlaying(p, now)) ?? null;

// Programs overlapping the [baseTime, baseTime + hours) window, de-duplicated by
// title+start and sorted by start time. Used by the full-guide grid.
export const getVisiblePrograms = (
  programs: Program[],
  baseTime: Date,
  hours: number
): Program[] => {
  const endTime = new Date(baseTime);
  endTime.setHours(endTime.getHours() + hours);

  return programs
    .filter((program) => program.start < endTime && program.end > baseTime)
    .filter(
      (program, index, self) =>
        index ===
        self.findIndex(
          (p) => p.title === program.title && p.start.getTime() === program.start.getTime()
        )
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());
};
