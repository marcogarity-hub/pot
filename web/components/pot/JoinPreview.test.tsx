import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { JoinPreview } from './JoinPreview';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

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

  it('shows the organizer by name when they set one, and falls back to their email', () => {
    const { rerender } = render(<JoinPreview {...props} organizerName="Hannah" />);
    expect(screen.getByText('Hannah')).toBeInTheDocument();
    expect(screen.queryByText('host@example.com')).toBeNull();
    rerender(<JoinPreview {...props} organizerName={null} />);
    expect(screen.getByText('host@example.com')).toBeInTheDocument();
  });

  it('offers an optional name field, filled with the saved name, that does not block joining', () => {
    render(<JoinPreview {...props} name="Ana R." />);
    expect(screen.getByLabelText('Your name')).toHaveValue('Ana R.');
    expect(screen.getByText(/other members see this instead of your email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join pot/i })).toBeEnabled();
  });
});
