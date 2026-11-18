import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SideNav } from './SideNav';

afterEach(() => cleanup());

const pots = [{ id: '7', title: 'Cabin weekend' }, { id: '9', title: 'Lake trip' }];

describe('SideNav', () => {
  it('lists the three sections, with Trips as the current page', () => {
    render(<SideNav pots={pots} name="Ana" email="ana@example.com" />);
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(sections).getAllByRole('link').map(l => l.textContent)).toEqual(['Trips', 'Activity', 'You']);
    expect(within(sections).getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
    expect(within(sections).getByRole('link', { name: 'Activity' })).toHaveAttribute('href', '#activity');
    expect(within(sections).getByRole('link', { name: 'You' })).toHaveAttribute('href', '#you');
  });

  it('links each pot to its page, one dot each', () => {
    render(<SideNav pots={pots} name="Ana" email="ana@example.com" />);
    const list = screen.getByRole('navigation', { name: 'Your trips' });
    expect(within(list).getByRole('link', { name: 'Cabin weekend' })).toHaveAttribute('href', '/pots/7');
    expect(within(list).getByRole('link', { name: 'Lake trip' })).toHaveAttribute('href', '/pots/9');
  });

  it('omits the pot list when there are no pots', () => {
    render(<SideNav pots={[]} name={null} email="ana@example.com" />);
    expect(screen.queryByRole('navigation', { name: 'Your trips' })).toBeNull();
  });

  it('offers New pot as the link to the create flow, and shows the viewer at the bottom', () => {
    render(<SideNav pots={pots} name={null} email="ana@example.com" />);
    expect(screen.getByRole('link', { name: 'New pot' })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', '#you');
  });

  it('is hidden below md, where the header and TabBar take over', () => {
    render(<SideNav pots={[]} name={null} email="ana@example.com" />);
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('hidden', 'md:flex');
  });
});
