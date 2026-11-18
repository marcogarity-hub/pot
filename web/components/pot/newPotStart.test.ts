import { describe, expect, it, vi } from 'vitest';
import { newPotStart } from './newPotStart';

const none = async () => null;

describe('newPotStart', () => {
  it('starts an empty form when there are no params', async () => {
    expect(await newPotStart({}, none)).toEqual({});
  });

  it('starts from a template with the name left empty and the placeholder set', async () => {
    expect(await newPotStart({ template: 'dinner' }, none)).toEqual({
      initial: { objectionWindow: 3600, requestWindow: 86400 },
      titlePlaceholder: 'Friday dinner',
    });
  });

  it('ignores an unknown template', async () => {
    expect(await newPotStart({ template: 'nope' }, none)).toEqual({});
    expect(await newPotStart({ template: 'constructor' }, none)).toEqual({});
  });

  it('ignores repeated params instead of crashing', async () => {
    expect(await newPotStart({ template: ['trip', 'rent'] }, none)).toEqual({});
  });

  it('runs a past pot with the loaded values', async () => {
    const loaded = { title: 'Cabin', total: '200', members: ['a@example.com'], threshold: 1 };
    const loadPot = vi.fn(async () => loaded);
    expect(await newPotStart({ from: '42' }, loadPot)).toEqual({ initial: loaded });
    expect(loadPot).toHaveBeenCalledWith('42');
  });

  it('falls back to an empty form when the past pot cannot be loaded, without using the template', async () => {
    expect(await newPotStart({ from: '42', template: 'trip' }, none)).toEqual({});
  });
});
