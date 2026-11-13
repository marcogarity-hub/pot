import { describe, expect, it } from 'vitest';
import type { CreatePotBody } from '@/app/api/pots/schema';
import { deriveShare, validateCreate } from './validate';

const now = new Date('2026-11-14T12:00:00Z');
const emails = (n: number) => Array.from({ length: n }, (_, i) => `m${i}@x.com`);
const base = (over: Partial<CreatePotBody> = {}): CreatePotBody => ({
  title: 'Cabin weekend',
  total: '2400',
  memberEmails: emails(8),
  deadline: '2026-11-20T12:00:00Z',
  threshold: 5,
  objectionWindowSeconds: 120,
  requestWindowSeconds: 120,
  ...over,
});
const errorsOf = (input: CreatePotBody) => {
  const r = validateCreate(input, now);
  if (r.ok) throw new Error('expected errors');
  return r.errors;
};

describe('validateCreate', () => {
  it('derives the share for 2400 across 8 members', () => {
    expect(validateCreate(base(), now)).toEqual({ ok: true, share: '300' });
  });

  it('keeps decimal shares exact', () => {
    expect(validateCreate(base({ total: '0.03', memberEmails: emails(3), threshold: 1 }), now)).toEqual({ ok: true, share: '0.01' });
  });

  it('rejects a total that does not divide evenly', () => {
    expect(errorsOf(base({ total: '100', memberEmails: emails(3), threshold: 1 })).total)
      .toBe('Total must divide evenly by the number of members');
  });

  it('rejects a zero or malformed total', () => {
    expect(errorsOf(base({ total: '0' })).total).toBeDefined();
    expect(errorsOf(base({ total: '12.5.1' })).total).toBeDefined();
    expect(errorsOf(base({ total: '' })).total).toBeDefined();
  });

  it('rejects duplicates after normalization', () => {
    const list = [...emails(7), ' M0@X.com '];
    expect(errorsOf(base({ memberEmails: list })).memberEmails).toBeDefined();
  });

  it('rejects 21 members and an empty list', () => {
    expect(errorsOf(base({ total: '2100', memberEmails: emails(21) })).memberEmails).toBeDefined();
    expect(errorsOf(base({ memberEmails: [] })).memberEmails).toBeDefined();
  });

  it('rejects an invalid email', () => {
    expect(errorsOf(base({ memberEmails: [...emails(7), 'not-an-email'] })).memberEmails).toBeDefined();
  });

  it('bounds the threshold by the member count', () => {
    expect(errorsOf(base({ threshold: 0 })).threshold).toBeDefined();
    expect(errorsOf(base({ threshold: 9 })).threshold).toBeDefined();
    expect(validateCreate(base({ threshold: 8 }), now).ok).toBe(true);
  });

  it('requires a deadline after now', () => {
    expect(errorsOf(base({ deadline: now.toISOString() })).deadline).toBeDefined();
    expect(errorsOf(base({ deadline: '2026-11-14T11:00:00Z' })).deadline).toBeDefined();
    expect(errorsOf(base({ deadline: 'garbage' })).deadline).toBeDefined();
  });

  it('bounds the objection window to 60 s .. 7 days', () => {
    expect(errorsOf(base({ objectionWindowSeconds: 59 })).objectionWindowSeconds).toBeDefined();
    expect(errorsOf(base({ objectionWindowSeconds: 604801 })).objectionWindowSeconds).toBeDefined();
    expect(validateCreate(base({ objectionWindowSeconds: 604800 }), now).ok).toBe(true);
  });

  it('bounds the request window to 60 s .. 30 days', () => {
    expect(errorsOf(base({ requestWindowSeconds: 59 })).requestWindowSeconds).toBeDefined();
    expect(errorsOf(base({ requestWindowSeconds: 2592001 })).requestWindowSeconds).toBeDefined();
    expect(validateCreate(base({ requestWindowSeconds: 2592000 }), now).ok).toBe(true);
  });

  it('requires a title', () => {
    expect(errorsOf(base({ title: '   ' })).title).toBeDefined();
  });
});

describe('deriveShare', () => {
  it('returns the exact share when the total divides evenly', () => {
    expect(deriveShare('2400', 8)).toBe('300');
    expect(deriveShare('0.03', 3)).toBe('0.01');
  });
  it('returns null for uneven, empty or invalid input', () => {
    expect(deriveShare('100', 3)).toBeNull();
    expect(deriveShare('100', 0)).toBeNull();
    expect(deriveShare('abc', 2)).toBeNull();
    expect(deriveShare('0', 2)).toBeNull();
  });
});
