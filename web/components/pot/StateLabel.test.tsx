import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StateLabel } from './StateLabel';

afterEach(() => cleanup());

describe('StateLabel', () => {
  it('shows the state label as text', () => {
    render(<StateLabel info={{ label: 'Locked', tone: 'neutral' }} />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('uses the danger ground and text colour for a danger tone', () => {
    render(<StateLabel info={{ label: 'Frozen', tone: 'danger' }} />);
    const label = screen.getByText('Frozen');
    expect(label).toHaveClass('text-destructive');
    expect(label).toHaveClass('bg-destructive-soft');
  });

  it('keeps the square marker decorative so the label carries the meaning', () => {
    const { container } = render(<StateLabel info={{ label: 'Released', tone: 'success' }} />);
    const marker = container.querySelector('span[aria-hidden]');
    expect(marker).toHaveClass('bg-success');
    expect(marker?.textContent).toBe('');
    expect(screen.getByText('Released')).toBeInTheDocument();
  });
});
