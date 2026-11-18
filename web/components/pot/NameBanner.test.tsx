import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NameBanner } from './NameBanner';

const openSettings = vi.hoisted(() => vi.fn());
vi.mock('./AppShell', () => ({ useOpenSettings: () => openSettings }));

afterEach(() => {
  cleanup();
  openSettings.mockClear();
});

describe('NameBanner', () => {
  it('explains why a name helps and offers to add one', () => {
    render(<NameBanner />);
    expect(screen.getByRole('region', { name: 'Add your name' })).toBeInTheDocument();
    expect(screen.getByText('Add your name so friends see you, not just a number.')).toBeInTheDocument();
  });

  it('opens Settings on the profile section when the button is pressed', () => {
    render(<NameBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Add your name' }));
    expect(openSettings).toHaveBeenCalledWith('profile');
  });
});
