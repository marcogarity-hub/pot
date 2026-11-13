import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import SignInPage from '@/app/(screens)/sign-in/page';

afterEach(() => cleanup());

describe('sign-in Suspense fallback', () => {
  it('has no enabled controls while searchParams are pending, so a fast submit cannot drop next', () => {
    // A never-resolving promise keeps the Suspense fallback on screen.
    const { container } = render(<SignInPage params={Promise.resolve({})} searchParams={new Promise(() => {})} />);
    const enabled = container.querySelectorAll('input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
    expect(enabled).toHaveLength(0);
    expect(container.querySelector('form')).toBeNull();
  });

  it('marks the placeholder as busy so assistive tech knows the form is loading', () => {
    const { container } = render(<SignInPage params={Promise.resolve({})} searchParams={new Promise(() => {})} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
