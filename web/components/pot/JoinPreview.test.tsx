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
    expect(screen.getByText('$300')).toBeInTheDocument();
    expect(screen.getByText('host@example.com')).toBeInTheDocument();
    expect(screen.getByText(/you'll join as/i)).toHaveTextContent('ana@example.com');
  });

  it('falls back to a neutral organizer line when the organizer is unknown', () => {
    render(<JoinPreview {...props} organizerEmail={null} />);
    expect(screen.getByText('Your organizer invited you')).toBeInTheDocument();
    expect(screen.queryByText('host@example.com')).toBeNull();
  });

  it('shows the cover with a close control that goes back home', () => {
    render(<JoinPreview {...props} />);
    expect(screen.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/');
  });

  it('states both guarantees in plain words', () => {
    render(<JoinPreview {...props} organizerName="Hannah" deadline="Fri, 11:59 PM" />);
    expect(screen.getByText('Held, not sent to Hannah')).toBeInTheDocument();
    expect(screen.getByText('Your share waits until everyone has paid.')).toBeInTheDocument();
    expect(screen.getByText('Not full by Fri, 11:59 PM?')).toBeInTheDocument();
    expect(screen.getByText('You get it back automatically.')).toBeInTheDocument();
  });

  it('lists who is in by "Member N" with paid and not-yet words, never by email', () => {
    const members = [
      { has_paid: true, has_refunded: false, active: true },
      { has_paid: false, has_refunded: false, active: true },
      { has_paid: true, has_refunded: true, active: true },
      { has_paid: true, has_refunded: false, active: false },
    ];
    render(<JoinPreview {...props} members={members} />);
    expect(screen.getByRole('heading', { name: /who's in/i })).toBeInTheDocument();
    expect(screen.getByText('1 of 3 paid')).toBeInTheDocument();
    expect(screen.getByText('Member 1')).toBeInTheDocument();
    expect(screen.getByText('Member 2')).toBeInTheDocument();
    expect(screen.getByText('Member 3')).toBeInTheDocument();
    expect(screen.queryByText('Member 4')).toBeNull();
    expect(screen.getAllByText('Paid')).toHaveLength(1);
    expect(screen.getAllByText('Not yet')).toHaveLength(2);
    expect(screen.getByText('split 3 ways')).toBeInTheDocument();
  });

  it('omits the who-is-in section when no members are given', () => {
    render(<JoinPreview {...props} />);
    expect(screen.queryByRole('heading', { name: /who's in/i })).toBeNull();
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
