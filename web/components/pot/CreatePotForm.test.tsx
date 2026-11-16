import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RECONCILE_INTERVAL_MS, RECONCILE_TIMEOUT_MS } from './reconcile';
import { CreatePotForm } from './CreatePotForm';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });
const CREATE = '/api/pots';
const RECONCILE = '/api/pots/reconcile';

// Local wall-clock time in the format a datetime-local input uses: YYYY-MM-DDTHH:mm.
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function fillForm(deadline = toLocalInput(new Date(Date.now() + 30 * 24 * 3600 * 1000))) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Cabin' } });
  fireEvent.change(screen.getByLabelText('Total (USDC)'), { target: { value: '200' } });
  fireEvent.change(screen.getByLabelText('Member 1 email'), { target: { value: 'a@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /add member/i }));
  fireEvent.change(screen.getByLabelText('Member 2 email'), { target: { value: 'b@example.com' } });
  fireEvent.change(screen.getByLabelText('Pay-in deadline'), { target: { value: deadline } });
}

const submitButton = () => screen.getByRole('button', { name: /create pot|finishing up|creating pot/i });

async function submit() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create pot' })); });
}

function callsTo(fetchMock: ReturnType<typeof vi.fn>, url: string) {
  return fetchMock.mock.calls.filter(c => c[0] === url);
}

beforeEach(() => { vi.useFakeTimers(); push.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('CreatePotForm deadline limit', () => {
  it('blocks a deadline more than one year away and never calls the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm />);
    fillForm('2030-01-01T10:00');
    await submit();
    expect(screen.getByText('Deadline must be within one year')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets the deadline picker max to one year from now', () => {
    render(<CreatePotForm />);
    const expected = toLocalInput(new Date(Date.now() + 365 * 24 * 3600 * 1000));
    expect(screen.getByLabelText('Pay-in deadline')).toHaveAttribute('max', expected);
  });
});

describe('CreatePotForm recovery', () => {
  it('creates the pot and goes to its page on 201', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ potId: '9', inviteToken: 't' }, 201)));
    render(<CreatePotForm />);
    fillForm();
    await submit();
    expect(push).toHaveBeenCalledWith('/pots/9');
  });

  it('CreatePending: shows "finishing", polls reconcile every 5 s, then redirects on 201', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: 'CreatePending', message: 'still', circleTransactionId: 'ctx-1' }, 502))
      .mockResolvedValueOnce(json({ error: 'StillPending' }, 202))
      .mockResolvedValueOnce(json({ potId: '42', inviteToken: 'tok' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm />);
    fillForm();
    await submit();

    expect(screen.getByRole('button', { name: /finishing up your pot/i })).toBeDisabled();
    const first = JSON.parse(callsTo(fetchMock, RECONCILE)[0][1].body);
    expect(first).toEqual({ title: 'Cabin', memberEmails: ['a@example.com', 'b@example.com'], circleTransactionId: 'ctx-1' });
    expect(push).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(RECONCILE_INTERVAL_MS); });
    expect(push).toHaveBeenCalledWith('/pots/42');
    expect(callsTo(fetchMock, RECONCILE)).toHaveLength(2);
    expect(callsTo(fetchMock, CREATE)).toHaveLength(1);
  });

  it('503 with potId and transactionHash: reconciles with the hash and redirects on 200', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ message: 'metadata needs recovery', potId: '42', transactionHash: '0xabc' }, 503))
      .mockResolvedValueOnce(json({ potId: '42', inviteToken: 'tok' }, 200));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm />);
    fillForm();
    await submit();
    const sent = JSON.parse(callsTo(fetchMock, RECONCILE)[0][1].body);
    expect(sent.transactionHash).toBe('0xabc');
    expect(sent).not.toHaveProperty('circleTransactionId');
    expect(push).toHaveBeenCalledWith('/pots/42');
  });

  it('409 CreateFailed re-enables the form with a retry message', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ error: 'CreatePending', message: 'still', circleTransactionId: 'ctx-1' }, 502))
      .mockResolvedValueOnce(json({ error: 'CreateFailed' }, 409)));
    render(<CreatePotForm />);
    fillForm();
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent("The pot wasn't created. You can try again.");
    expect(screen.getByRole('button', { name: 'Create pot' })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('422 MembersMismatch tells the user not to resubmit and keeps the form locked', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ error: 'CreatePending', message: 'still', circleTransactionId: 'ctx-1' }, 502))
      .mockResolvedValueOnce(json({ error: 'MembersMismatch' }, 422)));
    render(<CreatePotForm />);
    fillForm();
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(/don't submit it again/i);
    expect(screen.getByRole('button', { name: /create pot|finishing up|creating pot/i })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('times out after about 2 minutes with a do-not-resubmit message', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: 'CreatePending', message: 'still', circleTransactionId: 'ctx-1' }, 502))
      .mockResolvedValue(json({ error: 'StillPending' }, 202));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm />);
    fillForm();
    await submit();
    await act(async () => { await vi.advanceTimersByTimeAsync(RECONCILE_TIMEOUT_MS + RECONCILE_INTERVAL_MS); });
    expect(screen.getByRole('alert')).toHaveTextContent(/don't submit it again/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/refresh your pot list/i);
    expect(screen.getByRole('button', { name: /create pot|finishing up|creating pot/i })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
    expect(callsTo(fetchMock, CREATE)).toHaveLength(1);
  });

  it('does not send a second create or reconcile from repeated submits while finishing', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: 'CreatePending', message: 'still', circleTransactionId: 'ctx-1' }, 502))
      .mockResolvedValue(json({ error: 'StillPending' }, 202));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm />);
    fillForm();
    await submit();
    const form = submitButton().closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.click(submitButton());
    expect(callsTo(fetchMock, CREATE)).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(RECONCILE_INTERVAL_MS); });
    fireEvent.submit(form);
    expect(callsTo(fetchMock, CREATE)).toHaveLength(1);
    expect(callsTo(fetchMock, RECONCILE)).toHaveLength(2);
  });

  it('a 503 without a potId keeps the plain error and lets the user retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ message: 'Wallet provisioning pending. Please retry shortly.' }, 503)));
    render(<CreatePotForm />);
    fillForm();
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent('Wallet provisioning pending');
    expect(screen.getByRole('button', { name: 'Create pot' })).toBeEnabled();
  });
});

describe('CreatePotForm 502 with a transaction hash (UI-03)', () => {
  it('reconciles with the hash and keeps the form locked while it runs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ message: 'Pot creation could not be confirmed. Reconcile the transaction before retrying.', transactionHash: '0xdef' }, 502))
      .mockResolvedValue(json({ error: 'StillPending' }, 202));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm />);
    fillForm();
    await submit();
    const sent = JSON.parse(callsTo(fetchMock, RECONCILE)[0][1].body);
    expect(sent).toEqual({ title: 'Cabin', memberEmails: ['a@example.com', 'b@example.com'], transactionHash: '0xdef' });
    expect(screen.getByRole('button', { name: /finishing up your pot/i })).toBeDisabled();
    expect(callsTo(fetchMock, CREATE)).toHaveLength(1);
  });

  it('redirects once reconcile reports the pot', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ message: 'could not confirm', transactionHash: '0xdef' }, 502))
      .mockResolvedValueOnce(json({ potId: '77', inviteToken: 'tok' }, 201)));
    render(<CreatePotForm />);
    fillForm();
    await submit();
    expect(push).toHaveBeenCalledWith('/pots/77');
  });

  it('a 502 without any transaction hash re-enables the form and shows the message', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ message: 'Pot creation could not be confirmed.' }, 502));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm />);
    fillForm();
    await submit();
    expect(callsTo(fetchMock, RECONCILE)).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Pot creation could not be confirmed.');
    expect(screen.getByRole('button', { name: 'Create pot' })).toBeEnabled();
  });
});

describe('CreatePotForm validation announcements', () => {
  it('focuses the first invalid field, wires its error, and shows one summary alert', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<CreatePotForm />);
    await submit();
    const name = screen.getByLabelText('Name');
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Give the pot a name');
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/fix the fields with errors/i);
  });
});

describe('CreatePotForm window presets from the URL', () => {
  async function submitAndReadWindows(preset?: string) {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ potId: '1', inviteToken: 't' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm preset={preset} />);
    fillForm();
    await submit();
    const sent = JSON.parse(callsTo(fetchMock, CREATE)[0][1].body);
    return { objection: sent.objectionWindowSeconds, request: sent.requestWindowSeconds };
  }

  it('preset=booking starts on the production windows (48 hours, 7 days)', async () => {
    render(<CreatePotForm preset="booking" />);
    expect(screen.getByLabelText('Objection window')).toHaveTextContent('48 hours (production)');
    expect(screen.getByLabelText('Payout request window')).toHaveTextContent('7 days (production)');
    cleanup();
    expect(await submitAndReadWindows('booking')).toEqual({ objection: 172800, request: 604800 });
  });

  it('no preset keeps the old defaults', async () => {
    render(<CreatePotForm />);
    expect(screen.getByLabelText('Objection window')).toHaveTextContent('2 minutes (demo)');
    expect(screen.getByLabelText('Payout request window')).toHaveTextContent('2 minutes (demo)');
    cleanup();
    expect(await submitAndReadWindows()).toEqual({ objection: 120, request: 120 });
  });

  it('an unknown preset keeps the old defaults', async () => {
    render(<CreatePotForm preset="whatever" />);
    expect(screen.getByLabelText('Objection window')).toHaveTextContent('2 minutes (demo)');
    expect(screen.getByLabelText('Payout request window')).toHaveTextContent('2 minutes (demo)');
    cleanup();
    expect(await submitAndReadWindows('whatever')).toEqual({ objection: 120, request: 120 });
  });
});
