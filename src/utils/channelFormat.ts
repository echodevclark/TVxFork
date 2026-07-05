// Shared channel-name formatting and category detection.
// Previously duplicated (inconsistently) across Index.tsx, ChannelList.tsx and EPGView.tsx.

// Filler words stripped from channel display names (e.g. "Pulp Fiction Movies" -> "Pulp Fiction").
const FILLER_WORDS_REGEX = /\b(movies?|shows?|sports?|history|doc|documentary)\b/gi;

export const formatChannelName = (name: string): string =>
  name.replace(FILLER_WORDS_REGEX, '').trim();

export type ChannelCategory = 'movie' | 'show' | 'sport' | 'history' | 'doc' | null;

// Single, consistent precedence used everywhere a category icon is shown.
export const getChannelCategory = (name: string, group?: string): ChannelCategory => {
  const n = name.toLowerCase();
  const g = group?.toLowerCase() ?? '';
  const has = (token: string) => n.includes(token) || g.includes(token);

  if (has('movie')) return 'movie';
  if (has('show')) return 'show';
  if (has('sport')) return 'sport';
  if (has('history')) return 'history';
  if (has('doc')) return 'doc';
  return null;
};
