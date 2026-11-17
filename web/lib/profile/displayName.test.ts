import { describe, expect, it } from 'vitest';
import { MAX_DISPLAY_NAME, parseDisplayName } from './displayName';

describe('parseDisplayName', () => {
  it('keeps a plain name and trims it', () => {
    expect(parseDisplayName('  Ana R.  ')).toEqual({ ok: true, name: 'Ana R.' });
  });
  it('collapses runs of whitespace, including tabs and newlines, to one space', () => {
    expect(parseDisplayName('Ana \t\n  Ruiz')).toEqual({ ok: true, name: 'Ana Ruiz' });
  });
  it('treats blank, whitespace-only, null and undefined as clearing the name', () => {
    for (const v of ['', '   ', '\n', null, undefined]) expect(parseDisplayName(v)).toEqual({ ok: true, name: null });
  });
  it('accepts non-Latin names and emoji', () => {
    expect(parseDisplayName('José 田中')).toEqual({ ok: true, name: 'José 田中' });
    expect(parseDisplayName('Sam 🌲')).toEqual({ ok: true, name: 'Sam 🌲' });
  });
  it('allows exactly the maximum length and rejects one more, counting characters not UTF-16 units', () => {
    expect(parseDisplayName('a'.repeat(MAX_DISPLAY_NAME)).ok).toBe(true);
    expect(parseDisplayName('a'.repeat(MAX_DISPLAY_NAME + 1)).ok).toBe(false);
    expect(parseDisplayName('🌲'.repeat(MAX_DISPLAY_NAME)).ok).toBe(true);
    expect(parseDisplayName('🌲'.repeat(MAX_DISPLAY_NAME + 1)).ok).toBe(false);
  });
  it('rejects anything with an @ so an email cannot be saved as a name', () => {
    expect(parseDisplayName('ana@example.com')).toEqual({ ok: false, message: 'Use a name, not an email address.' });
    expect(parseDisplayName('@ana').ok).toBe(false);
  });
  it('rejects control and invisible format characters', () => {
    expect(parseDisplayName('Ana\u0000').ok).toBe(false);
    expect(parseDisplayName('Ana‮evil').ok).toBe(false);
    expect(parseDisplayName('A​na').ok).toBe(false);
  });
  it('rejects values that are not strings', () => {
    for (const v of [42, {}, [], true]) expect(parseDisplayName(v)).toEqual({ ok: false, message: 'Enter a name.' });
  });
});
