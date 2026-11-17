/** Longest display name, in characters. The database check matches this. */
export const MAX_DISPLAY_NAME = 40;

export type DisplayNameResult = { ok: true; name: string | null } | { ok: false; message: string };

/**
 * Cleans what someone typed as their name. Blank clears the name (null). Runs of spaces collapse to one.
 * Rejects control characters and anything with "@", so an email address cannot be saved back as a name.
 */
export function parseDisplayName(input: unknown): DisplayNameResult {
  if (input === null || input === undefined) return { ok: true, name: null };
  if (typeof input !== 'string') return { ok: false, message: 'Enter a name.' };
  const name = input.replace(/\s+/g, ' ').trim();
  if (name === '') return { ok: true, name: null };
  if (/\p{C}/u.test(name)) return { ok: false, message: 'That name has characters we cannot show.' };
  if (name.includes('@')) return { ok: false, message: 'Use a name, not an email address.' };
  if (Array.from(name).length > MAX_DISPLAY_NAME) return { ok: false, message: `Keep your name to ${MAX_DISPLAY_NAME} characters or fewer.` };
  return { ok: true, name };
}
