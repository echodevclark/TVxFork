// Shared time / timeline helpers. Previously inlined many times across Index.tsx and EPGView.tsx.

// Pixels per minute used by the full-guide timeline layout.
export const PX_PER_MINUTE = 4;

export const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

export const formatDuration = (start: Date, end: Date): string =>
  `${Math.round((end.getTime() - start.getTime()) / 60000)}min`;

// Minutes elapsed from `from` to `to` (may be fractional / negative).
export const minutesBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / 1000 / 60;

// A copy of `date` snapped down to the top of the hour (minutes/seconds/ms zeroed).
export const topOfHour = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
};
