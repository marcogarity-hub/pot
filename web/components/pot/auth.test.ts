import { describe, expect, it } from 'vitest';
import { magicLinkRedirect, resolveInvite, safeNext } from './auth';

describe('safeNext', () => {
  it('keeps same-origin relative paths', () => {
    expect(safeNext('/join/abc')).toBe('/join/abc');
    expect(safeNext('/pots/3')).toBe('/pots/3');
  });
  it('falls back to / for missing, absolute or protocol-relative targets', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext('')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('/\\evil.com')).toBe('/');
  });
});

describe('magicLinkRedirect', () => {
  it('points at the wallet callback and keeps next through sign-in', () => {
    expect(magicLinkRedirect('https://pot.example', '/join/tok123'))
      .toBe('https://pot.example/api/wallet/callback?next=%2Fjoin%2Ftok123');
  });
  it('strips a trailing slash from the app URL and sanitizes next', () => {
    expect(magicLinkRedirect('https://pot.example/', 'https://evil.com'))
      .toBe('https://pot.example/api/wallet/callback?next=%2F');
  });
});

describe('resolveInvite', () => {
  it('sends an invited member to the pot', () => {
    expect(resolveInvite({ potId: '4', invited: true, isOrganizer: false })).toEqual({ kind: 'pot', potId: '4' });
  });
  it('sends the organizer to the pot even without an invite row', () => {
    expect(resolveInvite({ potId: '4', invited: false, isOrganizer: true })).toEqual({ kind: 'pot', potId: '4' });
  });
  it('rejects someone whose email is not on the invite', () => {
    expect(resolveInvite({ potId: '4', invited: false, isOrganizer: false })).toEqual({ kind: 'not-invited' });
  });
  it('reports an unknown token', () => {
    expect(resolveInvite(null)).toEqual({ kind: 'not-found' });
  });
});
