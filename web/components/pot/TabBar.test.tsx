import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { TabBar } from './TabBar';

afterEach(() => cleanup());

describe('TabBar', () => {
  it('is a labelled navigation landmark with the three tabs', () => {
    render(<TabBar />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map(l => l.textContent)).toEqual(['Trips', 'Activity', 'You']);
  });

  it('marks Trips as the current page and points the others at their sections', () => {
    render(<TabBar />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Trips' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Activity' })).toHaveAttribute('href', '#activity');
    expect(within(nav).getByRole('link', { name: 'Activity' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'You' })).toHaveAttribute('href', '#you');
  });

  it('is hidden from md up, where the header carries the controls', () => {
    render(<TabBar />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass('md:hidden');
  });
});
