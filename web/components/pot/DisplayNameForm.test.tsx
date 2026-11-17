import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({ post: vi.fn(), refresh: vi.fn() }));
vi.mock('./api', () => ({ postJson: m.post }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn(), replace: vi.fn() }) }));
import { DisplayNameForm } from './DisplayNameForm';

beforeEach(() => { vi.clearAllMocks(); m.post.mockResolvedValue({ ok: true, status: 200, data: { name: 'Ana R.' } }); });
afterEach(() => cleanup());

const field = () => screen.getByLabelText('Your name') as HTMLInputElement;
const save = () => screen.getByRole('button', { name: /^(save|saving…)$/i });
const type = (v: string) => fireEvent.change(field(), { target: { value: v } });

describe('DisplayNameForm', () => {
  it('starts with the saved name and a disabled Save until something changes', () => {
    render(<DisplayNameForm initialName="Ana R." />);
    expect(field()).toHaveValue('Ana R.');
    expect(save()).toBeDisabled();
    type('Ana');
    expect(save()).toBeEnabled();
  });

  it('saves the cleaned name, confirms it, and refreshes the page data', async () => {
    render(<DisplayNameForm initialName={null} />);
    type('  Ana   R.  ');
    fireEvent.click(save());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'));
    expect(m.post).toHaveBeenCalledWith('/api/profile/name', { name: 'Ana R.' });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(field()).toHaveValue('Ana R.');
    expect(save()).toBeDisabled();
  });

  it('clearing the field removes the name', async () => {
    m.post.mockResolvedValue({ ok: true, status: 200, data: { name: null } });
    render(<DisplayNameForm initialName="Ana R." />);
    type('');
    fireEvent.click(save());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Name removed'));
    expect(m.post).toHaveBeenCalledWith('/api/profile/name', { name: null });
  });

  it('refuses an email address without calling the server', () => {
    render(<DisplayNameForm initialName={null} />);
    type('ana@example.com');
    fireEvent.click(save());
    expect(screen.getByRole('alert')).toHaveTextContent('Use a name, not an email address.');
    expect(m.post).not.toHaveBeenCalled();
  });

  it('shows the server message when saving fails and keeps what was typed', async () => {
    m.post.mockResolvedValue({ ok: false, status: 500, message: 'Could not save your name. Please try again.', body: {} });
    render(<DisplayNameForm initialName={null} />);
    type('Ana');
    fireEvent.click(save());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save your name'));
    expect(field()).toHaveValue('Ana');
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it('is announced as optional and tells people who sees the name', () => {
    render(<DisplayNameForm initialName={null} />);
    expect(field()).toHaveAccessibleDescription(/instead of your email.*optional/i);
  });
});
