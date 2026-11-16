import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { JoinPreview } from './JoinPreview';

afterEach(() => cleanup());

const props = { potId: '7', title: 'Cabin weekend', amount: '300', organizerEmail: 'host@example.com', email: 'ana@example.com' };

describe('JoinPreview', () => {
  it('shows the pot, the share, the organizer, and which account the viewer joins as', () => {
    render(<JoinPreview {...props} />);
    expect(screen.getByRole('heading', { name: /cabin weekend/i })).toBeInTheDocument();
    expect(screen.getByText('300 USDC')).toBeInTheDocument();
    expect(screen.getByText('host@example.com')).toBeInTheDocument();
    expect(screen.getByText(/you'll join as/i)).toHaveTextContent('ana@example.com');
  });

  it('omits the organizer line when it is unknown', () => {
    render(<JoinPreview {...props} organizerEmail={null} />);
    expect(screen.queryByText(/organized by/i)).toBeNull();
  });

  it('shows a joined state with a link to the pot after the primary button', () => {
    render(<JoinPreview {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /join pot/i }));
    expect(screen.getByRole('heading', { name: /you've joined/i })).toBeInTheDocument();
    expect(screen.queryByText(/you're in/i)).toBeNull();
    expect(screen.getByRole('link', { name: /go to pot/i })).toHaveAttribute('href', '/pots/7');
    expect(screen.queryByRole('button', { name: /join pot/i })).toBeNull();
  });
});
