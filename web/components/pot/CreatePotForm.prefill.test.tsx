import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreatePotForm } from './CreatePotForm';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockClear(); });

const DAY = 24 * 3600 * 1000;
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

describe('CreatePotForm starting values', () => {
  it('shows the initial values in the fields', () => {
    render(<CreatePotForm initial={{ title: 'Cabin', total: '200', members: ['a@example.com', 'b@example.com'], threshold: 2 }} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Cabin');
    expect(screen.getByLabelText('Total ($)')).toHaveValue('200');
    expect(screen.getByLabelText('Member 1 email')).toHaveValue('a@example.com');
    expect(screen.getByLabelText('Member 2 email')).toHaveValue('b@example.com');
    expect(screen.getByLabelText('Objections needed to block the payout')).toHaveValue(2);
  });

  it('never prefills the deadline', () => {
    render(<CreatePotForm initial={{ title: 'Cabin', total: '200', members: ['a@example.com'] }} />);
    expect(screen.getByLabelText('Pay-in deadline')).toHaveValue('');
  });

  it('uses the template placeholder for the name when given, and leaves the name empty', () => {
    render(<CreatePotForm titlePlaceholder="Friday dinner" initial={{ objectionWindow: 3600, requestWindow: 86400 }} />);
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('');
    expect(name).toHaveAttribute('placeholder', 'Friday dinner');
  });

  it('starts with one empty member row when no members are given', () => {
    render(<CreatePotForm initial={{ title: 'x' }} />);
    expect(screen.getAllByRole('textbox', { name: /Member \d email/ })).toHaveLength(1);
    expect(screen.getByLabelText('Member 1 email')).toHaveValue('');
  });

  it('falls back to the defaults for an out-of-range window or a bad threshold', () => {
    render(<CreatePotForm initial={{ objectionWindow: 30, requestWindow: Number.NaN, threshold: 0 }} />);
    expect(screen.getByLabelText('Objections needed to block the payout')).toHaveValue(1);
    expect(document.getElementById('objection-window-trigger')).toHaveTextContent('2 minutes (demo)');
    expect(document.getElementById('request-window-trigger')).toHaveTextContent('2 minutes (demo)');
  });

  it('offers 1 hour and 1 day as window presets', () => {
    render(<CreatePotForm initial={{ objectionWindow: 86400, requestWindow: 3600 }} />);
    expect(document.getElementById('objection-window-trigger')).toHaveTextContent('1 day');
    expect(document.getElementById('request-window-trigger')).toHaveTextContent('1 hour');
    expect(screen.queryByRole('spinbutton', { name: /in minutes/ })).not.toBeInTheDocument();
  });

  it('shows a window that matches no preset in the custom minutes field', () => {
    render(<CreatePotForm initial={{ objectionWindow: 3 * 24 * 3600 }} />);
    expect(screen.getByRole('spinbutton', { name: 'Objection window in minutes' })).toHaveValue(4320);
  });

  it('submits the same payload shape, with the chosen deadline', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ potId: '7', inviteToken: 't' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<CreatePotForm initial={{ title: 'Cabin', total: '200', members: ['a@example.com', 'b@example.com'], threshold: 1, objectionWindow: 3600, requestWindow: 86400 }} />);
    fireEvent.change(screen.getByLabelText('Pay-in deadline'), { target: { value: toLocalInput(new Date(Date.now() + 5 * DAY)) } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create plan' })); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body).sort()).toEqual(
      ['deadline', 'memberEmails', 'objectionWindowSeconds', 'requestWindowSeconds', 'threshold', 'title', 'total'],
    );
    expect(body).toMatchObject({
      title: 'Cabin', total: '200', memberEmails: ['a@example.com', 'b@example.com'], threshold: 1,
      objectionWindowSeconds: 3600, requestWindowSeconds: 86400,
    });
    expect(typeof body.deadline).toBe('string');
  });
});
