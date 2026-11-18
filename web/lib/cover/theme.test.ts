import { describe, expect, it } from 'vitest';
import { coverThemeFor } from './theme';

describe('coverThemeFor', () => {
  it('reads the title for a hint', () => {
    expect(coverThemeFor('Whistler ski weekend', 1)).toBe('freshPowder');
    expect(coverThemeFor('Tulum spring break', 2)).toBe('caribbeanNoon');
    expect(coverThemeFor('Joshua Tree weekend', 3)).toBe('highDesert');
    expect(coverThemeFor('Bowling night', 4)).toBe('stageNight');
    expect(coverThemeFor("Maya's birthday gift", 5)).toBe('stageNight');
    expect(coverThemeFor('Dinner in NYC', 6)).toBe('cityLights');
    expect(coverThemeFor('Lake house, August', 7)).toBe('rivieraSummer');
    expect(coverThemeFor('Cabin weekend', 8)).toBe('alpineDusk');
  });
  it('matches whole words only', () => {
    expect(coverThemeFor('Skillshare', 9)).not.toBe('freshPowder');
  });
  it('is stable for the same pot and varies across pots with no hint', () => {
    expect(coverThemeFor('Rent split', 11)).toBe(coverThemeFor('Rent split', 11));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => coverThemeFor(`Pot ${i}`, i)));
    expect(seen.size).toBeGreaterThan(3);
    expect(seen.has('stageNight')).toBe(false);
  });
  it('copes with a missing title', () => {
    expect(typeof coverThemeFor(null, 1)).toBe('string');
    expect(typeof coverThemeFor(undefined, 'x')).toBe('string');
  });
});
