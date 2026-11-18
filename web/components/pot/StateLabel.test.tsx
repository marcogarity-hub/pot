import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StateLabel } from './StateLabel';

afterEach(() => cleanup());

describe('StateLabel', () => {
  it('shows the state label as text', () => {
    render(<StateLabel info={{ label: 'Locked', tone: 'neutral' }} />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('uses the destructive text colour for a danger tone', () => {
    render(<StateLabel info={{ label: 'Frozen', tone: 'danger' }} />);
    const label = screen.getByText('Frozen');
    expect(label).toHaveClass('text-destructive');
    expect(label).not.toHaveClass('bg-destructive-soft');
  });

  it('is plain text with no marker, so the label carries the meaning', () => {
    const { container } = render(<StateLabel info={{ label: 'Released', tone: 'success' }} />);
    expect(screen.getByText('Released')).toHaveClass('text-success');
    expect(container.querySelector('span[aria-hidden]')).toBeNull();
  });
});
