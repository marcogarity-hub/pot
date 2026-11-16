import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { potAbi } from '@/lib/pot';
import { describeError, messages } from './errors';

it('has a readable message for RequestWindowClosed', () => {
  expect(messages.RequestWindowClosed).toBe('The time to request the payout has passed.');
});

it('has readable messages for every contract error in potAbi', () => {
  for (const entry of potAbi) {
    if (entry.type !== 'error') continue;
    expect(messages[entry.name], `${entry.name} needs a message`).toBeTruthy();
    expect(messages[entry.name]).not.toBe(entry.name);
  }
});

describe('describeError', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.CIRCLE_API_KEY = 'k3y-value-9876';
    delete process.env.CIRCLE_ENTITY_SECRET;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.QUICKNODE_STREAM_TOKEN;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  class CircleSdkError extends Error {
    config = { headers: { 'x-api-key': 'k3y-value-9876' }, url: 'https://api.circle.com/v1/w3s/wallets?token=abc' };
    response = { status: 401, data: { code: 2, message: 'Unauthorized', body: 'secret body text' }, headers: { authorization: 'Bearer abc123' } };
    code = 'ERR_BAD_REQUEST';
    constructor() { super('Request failed with status code 401'); }
  }

  it('returns only whitelisted fields for an axios-like error', () => {
    const result = describeError(new CircleSdkError());
    expect(result).toEqual({ name: 'CircleSdkError', message: 'Request failed with status code 401', status: 401, code: 'ERR_BAD_REQUEST' });
    const json = JSON.stringify(result);
    for (const leaked of ['k3y-value-9876', 'x-api-key', 'secret body', 'token=abc', 'config', 'headers', 'stack']) {
      expect(json).not.toContain(leaked);
    }
  });

  it('takes code from response.data.code and status from error.status when present', () => {
    const error = Object.assign(new Error('nope'), { status: 429, response: { data: { code: 155 } } });
    expect(describeError(error)).toEqual({ name: 'Error', message: 'nope', status: 429, code: 155 });
  });

  it('ignores non-string, non-number codes', () => {
    const error = Object.assign(new Error('nope'), { code: { nested: true }, response: { data: { code: [1] } } });
    const result = describeError(error);
    expect(result).not.toHaveProperty('code');
  });

  it('redacts the configured secret values from the message', () => {
    const result = describeError(new Error('Circle said k3y-value-9876 is bad'));
    expect(result.message).toBe('Circle said [redacted] is bad');
  });

  it('does not redact short or unset secret values', () => {
    process.env.CIRCLE_API_KEY = 'short';
    expect(describeError(new Error('short value stays')).message).toBe('short value stays');
  });

  it('redacts Bearer tokens and TEST/LIVE API key strings', () => {
    const result = describeError(new Error('auth Bearer abc123 and TEST_API_KEY:id:sec and LIVE_API_KEY:x:y'));
    expect(result.message).toBe('auth [redacted] and [redacted] and [redacted]');
  });

  it('truncates the message to 300 characters', () => {
    expect(describeError(new Error('x'.repeat(500))).message).toHaveLength(300);
  });

  it('redacts before truncating so a secret cut at the boundary cannot leak', () => {
    const message = 'a'.repeat(295) + 'k3y-value-9876';
    const result = describeError(new Error(message));
    expect(result.message).not.toContain('k3y');
  });

  it('returns a safe result for a string', () => {
    const result = describeError('plain failure');
    expect(result).toEqual({ name: 'UnknownError', message: 'plain failure' });
  });

  it('returns a safe result for null and undefined', () => {
    expect(describeError(null)).toEqual({ name: 'UnknownError', message: '' });
    expect(describeError(undefined)).toEqual({ name: 'UnknownError', message: '' });
  });
});
