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
  it('gives screen readers the same story as an ordered list', () => {
    render(<MoneyDiagram />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});
