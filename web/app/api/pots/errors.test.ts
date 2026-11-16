import { expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { potAbi } from '@/lib/pot';
import { messages } from './errors';

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
