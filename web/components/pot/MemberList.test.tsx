import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { MemberList } from './MemberList';

const PAID = '0x00000000000000000000000000000000000000a1';
const UNPAID = '0x00000000000000000000000000000000000000b2';
const GONE = '0x00000000000000000000000000000000000000c3';

const status = {
  share: '100000000000000000000',
  members: [
    { address: PAID, email: 'ana@example.com', has_paid: true, has_objected: false, has_refunded: false, active: true, is_organizer: true },
    { address: UNPAID, email: 'bo@example.com', has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: false },
    { address: GONE, email: 'cy@example.com', has_paid: true, has_objected: false, has_refunded: true, active: true, is_organizer: false },
  ],
} as unknown as PotStatusRow;

afterEach(() => cleanup());

describe('MemberList', () => {
  it('shows an avatar with initials, the email, and a Paid / Not paid / Refunded chip', () => {
    render(<MemberList status={status} myAddress={UNPAID} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('AN')).toBeInTheDocument();
    expect(within(rows[0]).getByText('ana@example.com')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Paid')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Not paid')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/\(you\)/)).toBeInTheDocument();
    expect(within(rows[2]).getByText('Refunded')).toBeInTheDocument();
  });

  it('keeps the organizer tag', () => {
    render(<MemberList status={status} myAddress={null} />);
    expect(screen.getByText('Organizer')).toBeInTheDocument();
  });
});
