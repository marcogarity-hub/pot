import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { PotActions } from './PotActions';

const status = {
  pot_id: '7', organizer_address: '0xaa', total: '200000000000000000000', share: '100000000000000000000',
  deadline: '2030-01-01T00:00:00Z', threshold: 1, objection_window_seconds: 120, request_window_seconds: 120,
  locked_at: null, state: 0, payments_count: 0, objections_count: 0, receipt_hash: null, release_eligible_at: null,
  updated_at: '', title: 'Trip', invite_token: 't', receipt_text: null, created_at: null, is_organizer: false, members: [],
} as PotStatusRow;

function deferred() {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>(r => { resolve = r; });
  return { promise, resolve };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('PotActions', () => {
  it('shows the share on the Pay button and POSTs to the pay route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactionHash: '0xabc' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PotActions potId="7" actions={['pay']} status={status} onSettled={() => {}} />);
    const pay = screen.getByRole('button', { name: /pay 100 usdc/i });
    await act(async () => { fireEvent.click(pay); });
    expect(fetchMock).toHaveBeenCalledWith('/api/pots/7/pay', expect.objectContaining({ method: 'POST' }));
  });

  it('disables Pay until the request settles', async () => {
    const d = deferred();
    const fetchMock = vi.fn().mockReturnValue(d.promise);
    vi.stubGlobal('fetch', fetchMock);
    render(<PotActions potId="7" actions={['pay']} status={status} onSettled={() => {}} />);
    const pay = screen.getByRole('button', { name: /pay 100 usdc/i });
    await act(async () => { fireEvent.click(pay); });
    expect(pay).toBeDisabled();
    fireEvent.click(pay);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve(new Response(JSON.stringify({ error: 'AlreadyPaid', message: "You've already paid into this pot." }), { status: 409 })); });
    expect(screen.getByRole('button', { name: /pay 100 usdc/i })).toBeEnabled();
  });

  it("shows the server's message on a 409", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'AlreadyPaid', message: "You've already paid into this pot." }), { status: 409 }),
    ));
    render(<PotActions potId="7" actions={['pay']} status={status} onSettled={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pay 100 usdc/i })); });
    expect(screen.getByRole('alert')).toHaveTextContent("You've already paid into this pot.");
  });

  it('shows a confirmation with the amount and one Done button after paying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactionHash: '0xabc' }), { status: 200 })));
    const onSettled = vi.fn();
    render(<PotActions potId="7" actions={['pay']} status={status} onSettled={onSettled} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pay 100 usdc/i })); });
    expect(screen.getByText(/you paid/i)).toBeInTheDocument();
    expect(screen.getByText('100 USDC')).toBeInTheDocument();
    expect(onSettled).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/you paid/i)).not.toBeInTheDocument();
  });

  it('sends receipt text with requestRelease', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactionHash: '0x1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PotActions potId="7" actions={['requestRelease']} status={{ ...status, state: 1 }} onSettled={() => {}} />);
    const button = screen.getByRole('button', { name: /request payout/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/receipt/i), { target: { value: 'Airbnb conf HMX123' } });
    await act(async () => { fireEvent.click(button); });
    expect(fetchMock).toHaveBeenCalledWith('/api/pots/7/request-release', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ receiptText: 'Airbnb conf HMX123' }),
    }));
  });
});

describe('PotActions confirmation', () => {
  const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  it('shows the amount, the pot name, the time, and the transaction as a short confirmation code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactionHash: hash }), { status: 200 })));
    render(<PotActions potId="7" actions={['pay']} status={{ ...status, title: 'Cabin weekend' }} onSettled={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pay 100 usdc/i })); });
    expect(screen.getByText('100 USDC')).toBeInTheDocument();
    expect(screen.getByText('Cabin weekend')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /0x1234.*cdef/ });
    expect(link).toHaveAttribute('href', `https://explorer.testnet.arc.io/tx/${hash}`);
    expect(link).toHaveTextContent('0x1234…cdef');
  });

  it('omits the confirmation code when the server returned no hash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    render(<PotActions potId="7" actions={['pay']} status={status} onSettled={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pay 100 usdc/i })); });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/you paid/i)).toBeInTheDocument();
  });
});

describe('PotActions session and refresh handling', () => {
  it('UI-01: a 401 shows the readable message and calls onAuthLost so the page can offer sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })));
    const onAuthLost = vi.fn();
    render(<PotActions potId="7" actions={['pay']} status={status} onSettled={() => {}} onAuthLost={onAuthLost} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pay 100 usdc/i })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.');
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it('UI-02: onSettled runs after an error response too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'AlreadyPaid', message: "You've already paid into this pot." }), { status: 409 }),
    ));
    const onSettled = vi.fn();
    render(<PotActions potId="7" actions={['pay']} status={status} onSettled={onSettled} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pay 100 usdc/i })); });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('UI-02: a 503 metadata-recovery response on request-release hides the request form, clears the receipt and shows the recovery text', async () => {
    const recoveryText = 'Transaction confirmed, but metadata needs recovery. Do not submit it again.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: recoveryText, potId: '7', transactionHash: '0xabc' }), { status: 503 }),
    ));
    const onSettled = vi.fn();
    render(<PotActions potId="7" actions={['requestRelease']} status={{ ...status, state: 1 }} onSettled={onSettled} />);
    fireEvent.change(screen.getByLabelText(/receipt/i), { target: { value: 'Airbnb conf HMX123' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /request payout/i })); });
    expect(screen.queryByRole('button', { name: /request payout|requesting/i })).toBeNull();
    expect(screen.queryByLabelText(/receipt/i)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(recoveryText);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
