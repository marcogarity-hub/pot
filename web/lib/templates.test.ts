import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateById } from './templates';
import { OBJECTION_MAX, OBJECTION_MIN, REQUEST_MAX, REQUEST_MIN } from '@/components/pot/validate';

describe('templates', () => {
  it('keeps every window inside the contract limits', () => {
    for (const t of Object.values(TEMPLATES)) {
      expect(t.objectionWindow).toBeGreaterThanOrEqual(OBJECTION_MIN);
      expect(t.objectionWindow).toBeLessThanOrEqual(OBJECTION_MAX);
      expect(t.requestWindow).toBeGreaterThanOrEqual(REQUEST_MIN);
      expect(t.requestWindow).toBeLessThanOrEqual(REQUEST_MAX);
    }
  });

  it('has the six starting points with their windows', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(['dinner', 'gift', 'group-order', 'rent', 'tickets', 'trip']);
    expect(templateById('trip')).toMatchObject({ label: 'Weekend trip', objectionWindow: 172800, requestWindow: 604800 });
    expect(templateById('dinner')).toMatchObject({ label: 'Group dinner', objectionWindow: 3600, requestWindow: 86400 });
    expect(templateById('tickets')).toMatchObject({ objectionWindow: 86400, requestWindow: 604800 });
  });

  it('returns undefined for unknown ids, including prototype names', () => {
    expect(templateById('nope')).toBeUndefined();
    expect(templateById('constructor')).toBeUndefined();
    expect(templateById('__proto__')).toBeUndefined();
    expect(templateById('')).toBeUndefined();
  });
});
