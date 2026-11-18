import { cn } from 'cn';
import { coverSvg, DEFAULT_THEME, THEMES, type ThemeKey } from '@/lib/cover/scenes';

/**
 * The trip's postcard cover: a drawn scene (never a photo, never advertised as generated).
 * Pots have no destination or dates yet, so every pot gets the default look (Alpine dusk).
 * Give it a height with `className` (it fills its box and crops the sides). `potId` keeps the
 * gradient ids unique when several covers share a page.
 */
export function TripCover({ potId, themeKey = DEFAULT_THEME, className }: {
  potId: string | number; themeKey?: ThemeKey; className?: string;
}) {
  const svg = coverSvg(themeKey, String(potId).replace(/[^A-Za-z0-9]/g, ''));
  // The markup comes from our own generator; the id suffix is restricted to letters and digits above.
  return <div aria-hidden className={cn('overflow-hidden bg-muted', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Very light tint for a trip's page background (content layer only). */
export function coverTint(themeKey: ThemeKey = DEFAULT_THEME): string {
  return THEMES[themeKey].tint;
}
