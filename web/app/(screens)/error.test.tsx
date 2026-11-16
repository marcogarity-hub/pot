import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ScreenError from './error';

afterEach(() => cleanup());

describe('ScreenError', () => {
  it('shows friendly copy without the error message or digest, and offers retry and home', () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('supabase url missing: secret-host'), { digest: 'dg-123' });
    render(<ScreenError error={error} reset={reset} />);

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.queryByText(/secret-host/)).toBeNull();
    expect(screen.queryByText(/dg-123/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });
});
