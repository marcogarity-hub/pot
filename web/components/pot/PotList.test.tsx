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

describe('PotList Run it again', () => {
  const finished = (state: PotState, over: Partial<PotSummary> = {}) => ({
    ...base, state, receipt_hash: null, is_organizer: true, ...over,
  }) as unknown as PotSummary;

  it('offers Run it again to the organizer of a released pot, pointing at the create form with this pot', () => {
    render(<PotList pots={[finished(PotState.Released, { pot_id: '9' })]} />);
    expect(screen.getByRole('link', { name: 'Run it again' })).toHaveAttribute('href', '/new?from=9');
  });

  it('offers it to the organizer of an expired or frozen pot too', () => {
    render(<PotList pots={[finished(PotState.Frozen, { pot_id: '4' })]} />);
    expect(screen.getByRole('link', { name: 'Run it again' })).toHaveAttribute('href', '/new?from=4');
  });

  it('does not offer it for a pot still in progress', () => {
    render(<PotList pots={[finished(PotState.Locked)]} />);
    expect(screen.queryByRole('link', { name: 'Run it again' })).toBeNull();
  });

  it('does not offer it to a member who is not the organizer', () => {
    render(<PotList pots={[finished(PotState.Released, { is_organizer: false })]} />);
    expect(screen.queryByRole('link', { name: 'Run it again' })).toBeNull();
  });
});
