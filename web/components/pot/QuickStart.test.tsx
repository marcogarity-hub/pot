import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { TEMPLATES } from '@/lib/templates';
import { QuickStart } from './QuickStart';

afterEach(() => cleanup());

describe('QuickStart', () => {
  it('lists every template as a link into the create form with that template preselected', () => {
    render(<QuickStart />);
    const section = screen.getByRole('heading', { name: 'Start something new' }).closest('section')!;
    const links = within(section).getAllByRole('link');
    expect(links).toHaveLength(Object.keys(TEMPLATES).length);
    for (const [id, template] of Object.entries(TEMPLATES)) {
      expect(within(section).getByRole('link', { name: template.label })).toHaveAttribute('href', `/new?template=${id}`);
    }
  });
});
