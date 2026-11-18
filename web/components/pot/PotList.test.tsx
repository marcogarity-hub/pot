import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PotState } from '@/lib/pot/chain';
import { PotList, type PotSummary } from './PotList';

afterEach(() => cleanup());

const base = {
  pot_id: '9', title: 'Cabin', total: '200000000000000000000', share: '100000000000000000000',
  is_organizer: false, members: [{ has_paid: true, has_refunded: false, active: true }],
};

describe('PotList state labels', () => {
  it('labels an expired pot Expired, the same as the detail page', () => {
    const pot = { ...base, state: PotState.Frozen, receipt_hash: null } as unknown as PotSummary;
    render(<PotList pots={[pot]} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText('Frozen')).toBeNull();
  });

  it('keeps Frozen for a pot frozen by objections', () => {
    const pot = { ...base, state: PotState.Frozen, receipt_hash: '0x' + 'ab'.repeat(32) } as unknown as PotSummary;
    render(<PotList pots={[pot]} />);
    expect(screen.getByText('Frozen')).toBeInTheDocument();
  });
});

describe('PotList trip cards', () => {
  it('shows the money collected so far against the total, in dollars', () => {
    const pot = {
      ...base,
      state: PotState.Locked, receipt_hash: null,
      total: '300000000000000000000', share: '100000000000000000000',
      members: [
        { has_paid: true, has_refunded: false, active: true, name: 'Ana' },
        { has_paid: true, has_refunded: false, active: true, name: 'Ben' },
        { has_paid: false, has_refunded: false, active: true, name: 'Cy' },
      ],
    } as unknown as PotSummary;
    render(<PotList pots={[pot]} />);
    expect(screen.getByText('$200', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('of $300', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 of 3 paid' })).toBeInTheDocument();
  });
});
