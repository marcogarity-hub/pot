import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MoneyDiagram } from './MoneyDiagram';

afterEach(cleanup);

describe('MoneyDiagram', () => {
  it('shows the three places the money moves through and the way back', () => {
    render(<MoneyDiagram />);
    expect(screen.getByText('Your wallet')).toBeInTheDocument();
    expect(screen.getByText('The plan’s pot')).toBeInTheDocument();
    expect(screen.getByText('The organizer')).toBeInTheDocument();
    expect(screen.getByText(/every share goes back to the person who paid it/i)).toBeInTheDocument();
  });
  it('tints the three places in the same size grid and the way back in rose', () => {
    render(<MoneyDiagram />);
    expect(screen.getByText('Your wallet').parentElement).toHaveClass('tint-sky');
    expect(screen.getByText('The plan’s pot').parentElement).toHaveClass('tint-sage');
    expect(screen.getByText('The organizer').parentElement).toHaveClass('tint-butter');
    expect(screen.getByText(/every share goes back/i).closest('p')).toHaveClass('tint-rose');
  });
  it('gives screen readers the same story as an ordered list', () => {
    render(<MoneyDiagram />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});
