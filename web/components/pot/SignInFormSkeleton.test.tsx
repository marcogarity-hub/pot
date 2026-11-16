import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SignInFormSkeleton } from './SignInFormSkeleton';

afterEach(() => cleanup());

describe('SignInFormSkeleton', () => {
  it('exposes its loading label to assistive tech as a busy status region', () => {
    render(<SignInFormSkeleton />);
    const region = screen.getByRole('status', { name: 'Loading sign-in form' });
    expect(region).toHaveAttribute('aria-busy', 'true');
  });
});
