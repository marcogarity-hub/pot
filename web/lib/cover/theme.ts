import type { ThemeKey } from './scenes';

/**
 * Which cover a pot gets, from its title. Pots have no destination or dates, so the title is the only hint:
 * "Whistler ski weekend" gets snow, "Tulum" a beach, "Bowling night" the stage. First matching rule wins.
 * A title with no hint gets a calm daytime look chosen by a stable hash, so the same pot always shows the same
 * cover on the dashboard, the pot page and the invite, and a list of pots does not repeat one picture.
 */
const RULES: Array<[RegExp, ThemeKey]> = [
  [/\b(ski|skiing|snowboard\w*|snow|whistler|aspen|vail|powder|winter|slopes?|alps|chalet)\b/i, 'freshPowder'],
  [/\b(concert|festival|show|gig|karaoke|bowling|party|birthday|wedding|bachelor(ette)?|game ?night|tickets?|club|nightlife)\b/i, 'stageNight'],
  [/\b(beach|tulum|cancun|cabo|miami|hawaii|maui|bali|island|cruise|surf\w*|resort|caribbean|bahamas|snorkel\w*)\b/i, 'caribbeanNoon'],
  [/\b(desert|vegas|joshua|palm springs|sedona|arizona|nevada|utah|moab|coachella|canyon)\b/i, 'highDesert'],
  [/\b(city|nyc|new york|chicago|london|paris|tokyo|berlin|rooftop|downtown|dinner|brunch)\b/i, 'cityLights'],
  [/\b(riviera|como|sailing|boat|yacht|lake house)\b/i, 'rivieraSummer'],
  [/\b(lake|cabin|tahoe|mountains?|hike|hiking|camp|camping|cottage|lodge)\b/i, 'alpineDusk'],
];

/** Calm daytime looks used when the title says nothing. The night scenes are only chosen by keyword. */
const FALLBACK: ThemeKey[] = ['alpineDusk', 'lakeMorning', 'rivieraSummer', 'highDesert', 'caribbeanNoon', 'freshPowder', 'cityLights'];

function hash(text: string): number {
  let h = 5381;
  for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function coverThemeFor(title: string | null | undefined, id: string | number): ThemeKey {
  const text = (title ?? '').trim();
  for (const [pattern, key] of RULES) if (pattern.test(text)) return key;
  return FALLBACK[hash(`${text}|${id}`) % FALLBACK.length];
}
