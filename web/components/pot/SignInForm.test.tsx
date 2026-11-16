import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { SignInForm } from './SignInForm';
import { magicLinkRedirect } from './auth';
import SignInPage from '@/app/(screens)/sign-in/page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace, refresh: nav.refresh }) }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));

const WRONG_CODE = 'That code is wrong or has expired. Check the newest email, or send a new code.';
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();

/** Lets pending mocked promises settle inside act(), without relying on timers. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

async function requestCode(email = 'Ada@Example.com') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /email me a sign-in link/i }));
  await settle();
}

function codeInput() {
  return screen.getByLabelText(/sign-in code/i) as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  signInWithOtp.mockResolvedValue({ error: null });
  verifyOtp.mockResolvedValue({ error: null });
  vi.mocked(createBrowserSupabase).mockReturnValue({ auth: { signInWithOtp, verifyOtp } } as unknown as ReturnType<typeof createBrowserSupabase>);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SignInForm step 1: email', () => {
  it('requests a code and link for the normalized email, with the same redirect as before', async () => {
    render(<SignInForm next="/join/tok" />);
    await requestCode('  Ada@Example.com ');
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      options: { emailRedirectTo: magicLinkRedirect(window.location.origin, '/join/tok') },
    });
  });

  it('moves to the code step, showing the email and a numeric code field', async () => {
    render(<SignInForm next="/" />);
    await requestCode();
    expect(screen.getByText('We emailed you a 6-digit code. Enter it below.')).toBeTruthy();
    expect(screen.getByText('ada@example.com')).toBeTruthy();
    expect(screen.getByText(/or click the link in the email/i)).toBeTruthy();
    const input = codeInput();
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
  });

  it('stays on step 1 and shows the error when the request fails', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Rate limit exceeded' } });
    render(<SignInForm next="/" />);
    await requestCode();
    expect(screen.getByRole('alert').textContent).toBe('Rate limit exceeded');
    expect(screen.queryByText('We emailed you a 6-digit code. Enter it below.')).toBeNull();
  });
});

describe('SignInForm step 2: verify', () => {
  it('verifies with type email and goes to the safe next target (a join link)', async () => {
    render(<SignInForm next="/join/tok_1" />);
    await requestCode();
    fireEvent.change(codeInput(), { target: { value: '482913' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await settle();
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'ada@example.com', token: '482913', type: 'email' });
    expect(nav.replace).toHaveBeenCalledWith('/join/tok_1');
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('sends an unsafe next to / after a successful verify', async () => {
    render(<SignInForm next="//evil.example" />);
    await requestCode();
    fireEvent.change(codeInput(), { target: { value: '482913' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await settle();
    expect(nav.replace).toHaveBeenCalledWith('/');
  });

  it('shows the wrong-code message, stays on the code step and keeps the typed code', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    render(<SignInForm next="/" />);
    await requestCode();
    fireEvent.change(codeInput(), { target: { value: '482913' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toBe(WRONG_CODE);
    expect(codeInput().value).toBe('482913');
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.getByText('We emailed you a 6-digit code. Enter it below.')).toBeTruthy();
  });

  it('strips non-digits and caps the code at 10 digits', async () => {
    render(<SignInForm next="/" />);
    await requestCode();
    fireEvent.change(codeInput(), { target: { value: ' 48-29a1 3 ' } });
    expect(codeInput().value).toBe('482913');
    fireEvent.change(codeInput(), { target: { value: '12345678901234' } });
    expect(codeInput().value).toBe('1234567890');
  });

  it('does not call verifyOtp with fewer than 6 digits', async () => {
    render(<SignInForm next="/" />);
    await requestCode();
    fireEvent.change(codeInput(), { target: { value: '12 34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await settle();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/6-digit code/);
  });
});

describe('SignInForm resend', () => {
  it('disables resend during the 30-second cooldown, then re-enables it and requests a new code', async () => {
    vi.useFakeTimers();
    render(<SignInForm next="/" />);
    await requestCode();

    const resend = () => screen.getByRole('button', { name: /send a new code/i }) as HTMLButtonElement;
    expect(resend().disabled).toBe(true);
    expect(resend().textContent).toContain('30');

    await act(async () => { vi.advanceTimersByTime(29_000); });
    expect(resend().disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(resend().disabled).toBe(false);
    expect(resend().textContent).toBe('Send a new code');

    fireEvent.change(codeInput(), { target: { value: '4829' } });
    fireEvent.click(resend());
    await settle();
    expect(signInWithOtp).toHaveBeenCalledTimes(2);
    expect(signInWithOtp).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'ada@example.com' }));
    expect(codeInput().value).toBe('');
    expect(screen.getByText('New code sent')).toBeTruthy();
    expect(resend().disabled).toBe(true);
  });
});

describe('SignInForm change email', () => {
  it('returns to step 1 from "Use a different email"', async () => {
    render(<SignInForm next="/" />);
    await requestCode();
    fireEvent.click(screen.getByRole('button', { name: /use a different email/i }));
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByRole('button', { name: /email me a sign-in link/i })).toBeTruthy();
    expect(screen.queryByLabelText(/sign-in code/i)).toBeNull();
  });
});

describe('sign-in page link-failure notice', () => {
  it('shows the calm notice above the form when error=link', async () => {
    await act(async () => {
      render(<SignInPage params={Promise.resolve({})} searchParams={Promise.resolve({ error: 'link' })} />);
    });
    expect(screen.getByText(/That sign-in link has expired/)).toBeTruthy();
    expect(document.querySelector('#email')).not.toBeNull();
  });

  it('shows no notice without the error param', async () => {
    await act(async () => {
      render(<SignInPage params={Promise.resolve({})} searchParams={Promise.resolve({ next: '/' })} />);
    });
    expect(document.querySelector('#email')).not.toBeNull();
    expect(screen.queryByText(/That sign-in link has expired/)).toBeNull();
  });
});
