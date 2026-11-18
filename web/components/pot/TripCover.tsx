import { cn } from 'cn';
import { coverSvg, DEFAULT_THEME, THEMES, type ThemeKey } from '@/lib/cover/scenes';
import { coverThemeFor } from '@/lib/cover/theme';

/**
 * The trip's postcard cover: a drawn scene (never a photo, never advertised as generated).
 * Pass the pot's `title` and the look follows its keywords ("ski" gets snow, "beach" a beach, with a stable
 * variety for titles that say nothing); without `title` (home, sign-in, dashboard art) it is the default look.
 * Give it a height with `className` (it fills its box and crops the sides). `potId` keeps the
 * gradient ids unique when several covers share a page.
 */
export function TripCover({ potId, title, themeKey, className }: {
  potId: string | number; title?: string | null; themeKey?: ThemeKey; className?: string;
}) {
  const key = themeKey ?? (title === undefined ? DEFAULT_THEME : coverThemeFor(title, potId));
  const svg = coverSvg(key, String(potId).replace(/[^A-Za-z0-9]/g, ''));
  // The markup comes from our own generator; the id suffix is restricted to letters and digits above.
  return <div aria-hidden className={cn('overflow-hidden bg-muted', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Very light tint for a trip's page background (content layer only). */
export function coverTint(themeKey: ThemeKey = DEFAULT_THEME): string {
  return THEMES[themeKey].tint;
}
