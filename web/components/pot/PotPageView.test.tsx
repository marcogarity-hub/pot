import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { PotPageView } from './PotPageView';

afterEach(() => cleanup());

const ME = '0x00000000000000000000000000000000000000a1';
const ORG = '0x00000000000000000000000000000000000000aa';
const NOW = Date.parse('2030-01-01T00:00:00Z');
const status = {
  pot_id: '3', title: 'Cabin weekend', organizer_address: ORG, total: '200000000000000000000', share: '100000000000000000000',
  deadline: '2030-01-02T00:00:00Z', threshold: 1, objection_window_seconds: 120, request_window_seconds: 120, locked_at: null,
  state: 0, payments_count: 1, objections_count: 0, receipt_hash: null, release_eligible_at: null, updated_at: '', invite_token: null,
  receipt_text: null, created_at: null, is_organizer: false,
  members: [
    { address: ME, email: 'ana@example.com', has_paid: true, has_objected: false, has_refunded: false, active: true, is_organizer: false },
    { address: ORG, email: null, has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: true },
  ],
} as unknown as PotStatusRow;

describe('PotPageView', () => {
  it('lays out the header, next step, lifecycle, members and details with the viewer tags', () => {
    render(<PotPageView status={status} nowMs={NOW} myAddress={ME} isOrganizer={false}
      actions={<p>ACTIONS</p>} notice={null} invite={null} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cabin weekend' })).toBeInTheDocument();
    expect(screen.getByText('You are a member')).toBeInTheDocument();
    expect(screen.getByText('ACTIONS')).toBeInTheDocument();
    const lifecycle = screen.getByRole('list', { name: 'Pot lifecycle' });
    expect(within(lifecycle).getByText(/Deadline in/)).toBeInTheDocument();
    expect(screen.getByText('1 of 2 paid')).toHaveClass('money');
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Organizer')).toBeInTheDocument();
    expect(screen.getByText('Each member pays')).toBeInTheDocument();
    expect(screen.getByText('Objection threshold')).toBeInTheDocument();
  });

  it('gives the desktop breadcrumb the pot title as the current page', () => {
    render(<PotPageView status={status} nowMs={NOW} myAddress={ME} isOrganizer={false}
      actions={null} notice={null} invite={null} />);
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Pots' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByText('Cabin weekend')).toHaveAttribute('aria-current', 'page');
  });

  it('puts the invite and the lifecycle in the side rail after the group', () => {
    render(<PotPageView status={status} nowMs={NOW} myAddress={ME} isOrganizer
      actions={null} notice={null} invite={<p>INVITE</p>} />);
    const group = screen.getByRole('heading', { name: 'The group' });
    const invite = screen.getByText('INVITE');
    const rail = screen.getByRole('heading', { name: "Where it's at" });
    expect(group.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(invite.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the organizer line and the invite slot for the organizer', () => {
    render(<PotPageView status={status} nowMs={NOW} myAddress={ORG} isOrganizer
      actions={null} notice={null} invite={<p>INVITE</p>} />);
    expect(screen.getByText('You organize')).toBeInTheDocument();
    expect(screen.getByText('INVITE')).toBeInTheDocument();
  });
});
